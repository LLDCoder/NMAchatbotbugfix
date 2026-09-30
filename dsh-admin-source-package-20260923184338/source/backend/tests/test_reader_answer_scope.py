from copy import deepcopy
from types import SimpleNamespace
import unittest
from app.reader_answer_scope import (KnowledgeScopeChallenge, scope_challenge_required,
    scope_challenge_input, validate_scope_challenge, apply_scope_challenge, apply_effective_scope_coverage)
from app.reader_answers import KnowledgeAnswerDraft, KnowledgeAnswerReview, AnswerBlockCheck
from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec, KnowledgeResolution
from app.reader_knowledge_coverage import knowledge_requirements


class IndependentScopeTests(unittest.TestCase):
    def fixture(self):
        quotes=[{'quoteIndex':0,'sourceId':'same_passage:p0','text':'Accounts definition and conditional procedure.'}]
        coverage=[{'requirementId':'object','status':'covered','requiredPoints':['Target is the login account.','Accounts uses login accounts.'],
                   'evidence':[{'sourceId':'same_passage:p0'}],'reason':'Initial points.'},
                  {'requirementId':'attribute_0','status':'covered','requiredPoints':['Conditional suspension needs notes.'],
                   'evidence':[{'sourceId':'same_passage:p0'}],'reason':'Same passage, valid procedure.'}]
        draft=KnowledgeAnswerDraft(stage='knowledge_answer_draft',blocks=[{'id':'answer','text':'Target is the login account. Conditional suspension needs notes.',
            'quoteIndexes':[0],'requirementIds':['object','attribute_0']}])
        review=KnowledgeAnswerReview(stage='knowledge_answer_review',checks=[],blockChecks=[AnswerBlockCheck(
            blockId='answer',supported=True,languageMatches=True,customerFacing=True,reason='Original review.')])
        data,origins=scope_challenge_input('Explain the fee waiver and Accounts suspension.',draft,coverage,quotes)
        checks=[]
        for c in data['candidateClaims']:
            invalid=c['candidateId'] in {'answer:answer','point:object:0'}
            checks.append({'candidateId':c['candidateId'],'claims':[{'claim':c['text'],'sourceContext':'Accounts procedure',
                'requestedContext':'Unidentified waiver customer','relation':'unproved_transfer' if invalid else 'same_context',
                'claimKind':'target_identity' if invalid else 'conditional_procedure','identityEvidence':'static_definition_only' if invalid else 'not_needed',
                'quoteIndexes':[0],'supported':not invalid,'reason':'Explicitly assessed scope.'}]})
        return quotes,coverage,draft,review,data,origins,KnowledgeScopeChallenge(stage='knowledge_scope_challenge',checks=checks)

    def test_guard_is_structural_not_keyword_or_identifier(self):
        reader=SimpleNamespace(readonly_alternative={'reason':'assistant_read_only'},route_record_proof={})
        task=SimpleNamespace(needsLiveData=False,recordIdentity='USER-SUPPLIED-ID')
        self.assertTrue(scope_challenge_required(reader,task))
        reader.readonly_alternative=None
        self.assertFalse(scope_challenge_required(reader,task))
        reader.readonly_alternative={'reason':'assistant_read_only'};task.needsLiveData=True
        self.assertFalse(scope_challenge_required(reader,task))
        task.needsLiveData=False;reader.route_record_proof={'matched':True}
        self.assertFalse(scope_challenge_required(reader,task))

    def test_sealed_input_has_claims_and_sources_without_previous_verdicts(self):
        _,_,_,_,data,_,_=self.fixture()
        self.assertEqual(set(data),{'originalRequest','sources','candidateClaims'})
        for c in data['candidateClaims']:
            self.assertEqual(set(c),{'candidateId','text','quoteIndexes'})
        self.assertNotIn('knowledgeCoverage',data)

    def test_same_passage_preserves_valid_neighbor_point_and_procedure(self):
        _,coverage,_,review,data,origins,plan=self.fixture()
        before=deepcopy(coverage)
        validate_scope_challenge(plan,data)
        effective,receipts=apply_scope_challenge(plan,origins,review,coverage)
        self.assertEqual(coverage,before)
        self.assertEqual(effective[0]['requiredPoints'],['Accounts uses login accounts.'])
        self.assertEqual(effective[0]['status'],'partial')
        self.assertEqual(effective[1],before[1])
        self.assertEqual(receipts[0]['invalidatedPoints'][0]['pointIndex'],0)
        self.assertEqual(receipts[0]['retainedPointOriginalIndexes'],[1])
        self.assertFalse(review.blockChecks[0].supported)

    def test_model_live_verified_label_cannot_create_record_identity(self):
        *_,data,origins,plan=self.fixture()
        claim=plan.checks[0].claims[0]
        claim.identityEvidence='live_verified';claim.relation='same_context';claim.supported=True
        validate_scope_challenge(plan,data)
        self.assertFalse(claim.supported)

    def test_unknown_candidate_or_missing_point_cannot_silently_pass(self):
        *_,data,origins,plan=self.fixture()
        plan.checks.pop()
        with self.assertRaises(PipelineError):validate_scope_challenge(plan,data)

    def test_counterevidence_must_be_in_supplied_sources(self):
        *_,data,origins,plan=self.fixture()
        plan.checks[0].claims[0].quoteIndexes=[99]
        with self.assertRaises(PipelineError):validate_scope_challenge(plan,data)

    def test_challenge_cannot_upgrade_a_preexisting_answer_rejection(self):
        _,coverage,_,review,data,origins,plan=self.fixture()
        review.blockChecks[0].supported=False
        for check in plan.checks:
            for claim in check.claims:
                claim.claimKind='conditional_procedure';claim.relation='same_context';claim.identityEvidence='not_needed';claim.supported=True
        validate_scope_challenge(plan,data)
        effective,receipts=apply_scope_challenge(plan,origins,review,coverage)
        self.assertFalse(review.blockChecks[0].supported)
        self.assertEqual(effective,coverage)
        self.assertEqual(receipts,[])

    def test_effective_coverage_reaches_real_finish_quality_and_audit(self):
        quotes,coverage,_,review,data,origins,plan=self.fixture()
        validate_scope_challenge(plan,data)
        effective,invalidations=apply_scope_challenge(plan,origins,review,coverage)
        task=TaskSpec(stage='task',businessObject='customer',requestedScope='unknown',requestedGrain='unknown',
            requestedMeasures=[],requestedAttributes=['conditional suspension procedure'],groupBy=[],timeRange='unknown',
            filters=[],outputShape='detail',needsLiveData=False,readOnly=True,searchQuery='customer explanation',unresolvedSlots=[])
        reader=GenericKnowledgeReader(None,None,portal_base_url='https://portal.test')
        reader.knowledge_requirement_coverage=deepcopy(coverage)
        for stage in ('identity_context','intent','query_expansion','knowledge_retrieval','knowledge_coverage'):
            reader.quality.record(stage,'passed')
        resolution=KnowledgeResolution(stage='knowledge_resolution',route='',pageName='',routeEvidence=[],answerEvidence=[],missing=[])
        answer_data={'knowledgeCoverage':deepcopy(coverage)}
        apply_effective_scope_coverage(reader,answer_data,resolution,effective,invalidations,1)
        outcome=reader.finish(task=task,knowledge_quotes=quotes,answer_coverage=[{
            'requirementId':r['id'],'status':'covered','quoteIndexes':[0],'reason':'Stale reviewer claims covered.'}
            for r in knowledge_requirements(task)]).result.public_json()
        self.assertFalse(outcome['requirementsSatisfied'])
        self.assertFalse(outcome['knowledgeRequirementsSatisfied'])
        self.assertEqual(outcome['knowledgeRequirementCoverage'],effective)
        self.assertIn('knowledge_requirements_incomplete',outcome['missing'])
        self.assertIn('knowledge_coverage',outcome['qualityBlockers'])
        self.assertEqual(resolution.missing,['object'])
        self.assertEqual(reader.audit['knowledgeAnswerOriginalCoverage'],coverage)
        self.assertEqual(reader.audit['knowledgeAnswerEffectiveCoverage'],effective)


if __name__=='__main__':unittest.main()
