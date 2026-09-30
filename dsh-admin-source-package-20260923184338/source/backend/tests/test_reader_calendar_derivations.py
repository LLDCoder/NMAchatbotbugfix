import pytest
from test_reader_clock_and_identity import fixture,collect,checked_collections
from app.reader_derivations import compile_derivations,apply_derivations

@pytest.mark.parametrize('zone,start,reference,expected',[
 ('Asia/Dubai','2026-09-27T23:59:00','2026-09-27T20:01:00Z',1),
 ('Asia/Dubai','2026-09-28T00:00:00','2026-09-27T20:01:00Z',0),
 ('Asia/Dubai','2026-09-29T00:00:00','2026-09-27T20:01:00Z',-1),
 ('America/New_York','2026-03-08T00:00:00','2026-03-09T04:00:00Z',1),
 ('America/New_York','2026-11-01T00:00:00','2026-11-02T05:00:00Z',1),
 ('UTC','2026-01-31T12:00:00','2026-02-01T01:00:00Z',1)])
def test_calendar_day_difference_uses_page_timezone_not_elapsed_24_hour_units(zone,start,reference,expected):
    rows,captured,spec,kb,source,rule=fixture();rule.update(operator='calendar_days',sourceTimezone=zone)
    for row in rows:row.update(due=start,closed=None)
    compiled=compile_derivations(kb,'/specimens',source,spec);spec.fields=compiled['fields']
    receipt,_=collect(rows,captured,spec);receipt['startedAt']=reference
    result=apply_derivations(checked_collections([receipt])[0],compiled)
    assert [x['clock'] for x in result['rows']]==[expected,expected,None]
    assert result['derivation']['inputProjectionHash']==receipt['projectionHash']
