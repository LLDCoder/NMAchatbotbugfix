"""The selected page is a navigation referent, never a permission or data grant."""
from app.reader_context import page_hint


def catalog():
    return [{"id":"crystals", "name":"Crystal Tasks", "module":"Work", "description":"Current crystal tasks",
             "routes":["/work/crystals"], "parameters":["code"], "fields":["secret"], "permissions":["all"]},
            {"id":"other", "name":"Other workspace", "routes":["/other"], "parameters":[]}]

def test_current_page_reference_exposes_only_exact_authorized_catalog_metadata():
    hint=page_hint({"route":"/work/crystals", "view":"open"},catalog(),lambda _:True)
    assert hint['pageCandidates']==[{"id":"crystals", "name":"Crystal Tasks", "module":"Work", "description":"Current crystal tasks"}]
    assert hint['view']=='open'
    assert not any(hint[k] for k in ['recordVerified','viewVerified','filtersVerified'])
    assert 'scope' not in hint and 'permissions' not in str(hint['pageCandidates'])

def test_unauthorized_or_unknown_page_cannot_supply_catalog_metadata():
    for route,allowed in [('/work/crystals',False),('/missing',True)]:
        hint=page_hint({'route':route},catalog(),lambda _:allowed)
        assert hint=={'status':'unavailable','reason':'page_not_in_authorized_catalog'}

def test_ambiguous_catalog_mapping_is_retained_instead_of_silently_picking_first():
    pages=catalog();pages.append({**pages[0],'id':'second','name':'Alternative view'})
    hint=page_hint({'route':'/work/crystals'},pages,lambda _:True)
    assert [p['id'] for p in hint['pageCandidates']]==['crystals','second']

def test_oversized_or_nontext_catalog_metadata_does_not_expand_hint_payload():
    pages=catalog();pages[0].update(name='x'*300,description='y'*1500,module={'private':'value'})
    hint=page_hint({'route':'/work/crystals'},pages,lambda _:True)
    assert len(hint['pageCandidates'][0]['name'])==200
    assert len(hint['pageCandidates'][0]['description'])==1200
    assert 'module' not in hint['pageCandidates'][0]
