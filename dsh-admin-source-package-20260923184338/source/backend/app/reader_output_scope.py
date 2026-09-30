"""An observation label cannot substitute for a proven requested population."""


def confirmed_output_contexts(outputs, coverage):
    contexts = [c for c in coverage if c.get('kind') in
                {'object', 'scope', 'population', 'record', 'filter', 'view'}]
    accepted, withheld = [], []
    for output in outputs:
        missing = [c['id'] for c in contexts if c['status'] != 'satisfied'
                   or output['id'] not in c.get('outputIds', [])]
        if missing:
            withheld.append({'outputId': output['id'], 'requirementIds': missing,
                             'reason': 'requested_record_context_unverified'})
        else:
            accepted.append(output)
    return accepted, withheld
