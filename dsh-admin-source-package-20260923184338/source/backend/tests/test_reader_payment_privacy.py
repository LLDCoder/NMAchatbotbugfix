import pytest

from app.generic_reader import PipelineError, clean, pointer, row_scalar


@pytest.mark.parametrize('field', ['bankAccount', 'bank_account_number', 'IBAN',
    'cardNumber', 'creditCardNumber', 'paymentCardInformation', 'cardSecurityCode',
    'cardVerificationValue', 'primaryAccountNumber', 'cvv', 'CVC'])
def test_payment_credentials_never_become_model_context_or_output_fields(field):
    data = {'payment': {field: 'test-sensitive-value'}, 'amount': 1000, 'currency': 'AED'}
    assert clean(data)['payment'][field] == '[redacted]'
    with pytest.raises(PipelineError, match='output_field_restricted'):
        pointer(data, '/payment/' + field)
    with pytest.raises(PipelineError, match='output_field_restricted'):
        row_scalar(data, 'payment.' + field)


def test_payment_summary_fields_remain_readable_without_credentials():
    data = {'amount': 1000, 'currency': 'AED', 'transactionNo': 'PAY-42', 'cardTotal': 20}
    assert clean(data) == data
    for field, value in data.items():
        assert pointer(data, '/' + field) == value
        assert row_scalar(data, field) == value
