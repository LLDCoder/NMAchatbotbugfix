"""Read submitted form schemas/values using a page-declared structural adapter.

No component-specific rules, network requests, scripts or attachment bodies.
"""
import json
from .reader_scalars import scalar_equal


def compile_form_bindings(plan, catalog, requirements, sources):
    """Compile a selected form adapter, keeping its record and document distinct."""
    from .generic_reader import PipelineError
    corrections, compiled = [], []
    for step in plan.steps:
        if step.op != 'assess_form':
            continue
        fact = catalog.get(step.knowledgeBindingId, {})
        spec = fact.get('formDefinition') or {}
        source = sources.get(step.sourceId, {})
        proof = source.get('verifiedRecord') or {}
        if (not spec or fact.get('operationRef') != source.get('operationRef')
                or not proof.get('single') or proof.get('path') != spec.get('recordPath')
                or spec.get('recordPath') != fact.get('sourcePath')):
            continue  # Existing binding/identity checks report the precise gap.
        if step.inputs or step.path not in {fact['sourcePath'], spec.get('documentPath')}:
            raise PipelineError('analysis_form_binding_mismatch', 'planning', {'stepId': step.id})
        before = {'path': step.path, 'fields': list(step.fields)}
        step.path, step.fields = fact['sourcePath'], list(fact['fields'])
        for binding in plan.requirementBindings:
            if (binding.knowledgeBindingId == step.knowledgeBindingId
                    and binding.sourceId == step.sourceId and step.id in binding.stepIds
                    and requirements.get(binding.requirementId, {}).get('kind') == 'attribute'):
                binding.sourcePath = fact['sourcePath']
                binding.fields = list(fact['fields'])
                binding.stepIds = [step.id]
        compiled.append((step.sourceId, {fact['sourcePath'], spec.get('documentPath')}))
        corrections.append({'reason': 'compiled_declared_form_record_and_document',
            'stepId': step.id, 'knowledgeBindingId': step.knowledgeBindingId,
            'before': before, 'after': {'path': step.path, 'fields': list(step.fields)}})
    return compiled, corrections


def assess_form(source, fact):
    from .generic_reader import PipelineError, pointer, SENSITIVE_FIELD, TRUNCATION
    spec = fact.get('formDefinition') or {}
    if spec.get('format') != 'schema_values/1':
        raise PipelineError('form_encoding_unsupported', 'engine_capability_gap')
    proof = source.get('verifiedRecord') or {}
    if not proof.get('single') or proof.get('path') != spec.get('recordPath'):
        raise PipelineError('form_record_unverified')
    version_path = spec.get('versionPath')
    if not isinstance(version_path, str) or not version_path.startswith('/'):
        raise PipelineError('form_version_unverified')
    try:
        version = pointer(source['data'], version_path)
    except (PipelineError, KeyError) as exc:
        raise PipelineError('form_version_unverified') from exc
    if not isinstance(version, (str, int)) or isinstance(version, bool) or str(version) in {'', '0', *TRUNCATION}:
        raise PipelineError('form_version_unverified')
    document = next((d for d in source.get('structuredDocuments', []) if d['path'] == spec.get('documentPath', fact['sourcePath'])), None)
    if not document or document.get('completeness') != 'complete':
        raise PipelineError('form_data_unavailable', 'source_data')
    data = document['data']
    containers = data if isinstance(data, list) else [data]
    if len(containers) > 40:
        raise PipelineError('form_budget_exceeded', 'engine_capability_gap')
    allowed = spec.get('materialComponents', [])
    if not isinstance(allowed, list) or not allowed or any(not isinstance(v, str) for v in allowed):
        raise PipelineError('form_material_definition_missing')
    applicability_verified = spec.get('applicabilityComplete') is True
    results, reasons, visited = [], [], [0]
    def evaluate_condition(condition, values):
        # Page knowledge may normalize a declarative condition; arbitrary JS
        # expressions and callback objects are never interpreted as conditions.
        if not isinstance(condition, dict) or set(condition) - {'field', 'equals', 'notEquals'}:
            return None
        field = condition.get('field')
        if not isinstance(field, str) or SENSITIVE_FIELD.search(field):
            return None
        if not isinstance(values, dict) or field not in values or values[field] is None:
            return None
        if 'equals' in condition and 'notEquals' not in condition:
            return scalar_equal(values[field], condition['equals'])
        if 'notEquals' in condition and 'equals' not in condition:
            return not scalar_equal(values[field], condition['notEquals'])
        return None
    def walk(schema, values, prefix='', depth=0, inherited_unknown=False):
        visited[0] += 1
        if visited[0] > 1000 or depth > 16:
            raise PipelineError('form_budget_exceeded', 'engine_capability_gap')
        if not isinstance(schema, dict):
            return
        inherited_unknown = inherited_unknown or any(k in schema for k in ('x-reactions', 'if', 'then', 'else', 'dependencies'))
        properties = schema.get('properties') or {}
        if not isinstance(properties, dict):
            raise PipelineError('form_schema_invalid', 'source_data')
        required_names = schema.get('required') if isinstance(schema.get('required'), list) else []
        for key, field in properties.items():
            if not isinstance(field, dict):
                continue
            name = prefix + key
            # Unknown conditional visibility applies to descendants too.
            conditional = inherited_unknown or not applicability_verified or any(k in field for k in ('x-reactions', 'if', 'then', 'else', 'dependencies'))
            value = values.get(key) if isinstance(values, dict) else None
            component = field.get(spec.get('componentKey', 'x-component'))
            if component in allowed:
                status = 'unknown'
                required = field.get('required', key in required_names)
                validators = field.get('x-validator', [])
                validators = validators if isinstance(validators, list) else [validators]
                for validator in validators:
                    if isinstance(validator, dict) and 'required' in validator:
                        if 'required' in field and not scalar_equal(required, validator['required']):
                            conditional = True
                        required = validator['required']
                conditions = field.get(spec.get('requiredWhenKey', 'requiredWhen'))
                if conditions is not None:
                    condition = evaluate_condition(conditions, values)
                    conditional = conditional or condition is None
                    required = condition if condition is not None else required
                restricted = bool(SENSITIVE_FIELD.search(name))
                if not conditional and type(required) is bool and not restricted:
                    if not required:
                        status = 'not_required'
                    elif isinstance(value, str) and value in TRUNCATION:
                        status = 'unknown'
                    else:
                        status = 'missing' if value is None or value == '' or value == [] or value == {} else 'present'
                if status == 'unknown':
                    reasons.append('form_applicability_unverified' if not applicability_verified else
                                   'form_condition_unsupported' if conditional else 'form_field_unconfirmed')
                title = field.get('title')
                results.append({'field': '[restricted]' if restricted else name,
                                'label': title if isinstance(title, str) and not restricted else 'Material',
                                'status': status})
            elif field.get('type') == 'array' and field.get('items'):
                # Repeated structures need an observed array to enumerate. An
                # empty required collection is not a fabricated missing child.
                if not isinstance(value, list):
                    reasons.append('form_repeated_values_unavailable')
                else:
                    for index, child in enumerate(value[:100]):
                        walk(field['items'], child, name + f'[{index}].', depth + 1, conditional)
                    if len(value) > 100:
                        raise PipelineError('form_budget_exceeded', 'engine_capability_gap')
            else:
                is_void = field.get('type') == 'void'
                walk(field, values if is_void else value, prefix if is_void else name + '.', depth + 1, conditional)
    for container in containers:
        try:
            form = pointer(container, spec['containerPath']) if spec.get('containerPath') else container
            schema = pointer(form, spec.get('schemaPath', '/schema'))
            values = pointer(form, spec.get('valuesPath', '/formValues'))
        except (PipelineError, KeyError) as exc:
            raise PipelineError('form_schema_values_unavailable', 'source_data') from exc
        if not all(isinstance(v, dict) for v in (container, form, schema, values)):
            raise PipelineError('form_schema_values_unavailable', 'source_data')
        walk(schema, values, inherited_unknown=bool(form.get('skipWhen') or container.get('skipWhen')))
    if not results:
        reasons.append('form_material_fields_unavailable')
    return results, list(dict.fromkeys(reasons)), {'version': str(version), 'versionPath': spec['versionPath'],
        'documentHash': document.get('contentHash'), 'recordIdentity': proof['identity'],
        'bindingId': fact['knowledgeBindingId']}


def public_form_gap(code, language='en'):
    messages = {
        'form_version_unverified': {
            'en': 'The applicable form version could not be verified, so missing required documents cannot be determined.',
            'ar': 'لم يتم التحقق من إصدار النموذج المنطبق، لذلك لا يمكن تحديد المستندات المطلوبة الناقصة.',
            'zh': '尚未核实适用的表单版本，因此无法确定缺少哪些必需材料。'},
        'form_data_unavailable': {
            'en': 'The stored form and submitted values could not be read completely; this does not establish that documents are missing.',
            'ar': 'تعذرت قراءة النموذج المخزَّن والقيم المقدَّمة كاملةً؛ وهذا لا يثبت نقص المستندات.',
            'zh': '无法完整读取保存的表单及提交值；这不代表材料未提交。'},
        'form_material_definition_missing': {
            'en': 'The page knowledge does not identify which form fields represent documents, so document completeness cannot be assessed.',
            'ar': 'لا تحدد معرفة الصفحة حقول النموذج التي تمثل المستندات، لذلك لا يمكن تقييم اكتمالها.',
            'zh': '页面知识尚未明确哪些表单字段代表材料，因此无法判断材料是否齐全。'},
    }
    values=messages.get(code,{})
    return values.get(language,values.get('en',''))
