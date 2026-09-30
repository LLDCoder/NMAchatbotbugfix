"""Typed JSON scalar comparisons shared by execution and proof validation."""


def scalar_equal(left, right):
    # JSON booleans and numbers are different types, unlike Python bool/int.
    if isinstance(left, bool) != isinstance(right, bool):
        return False
    if isinstance(left, list) or isinstance(right, list):
        return isinstance(left, list) and isinstance(right, list) and len(left) == len(right) and all(
            scalar_equal(a, b) for a, b in zip(left, right))
    return left == right


def scalar_compare(left, predicate, right):
    if predicate in {'in', 'not_in'}:
        if not valid_condition_value(predicate, right) or isinstance(left, (dict, list)):
            raise TypeError('Membership requires a bounded scalar set')
        matched = any(scalar_equal(left, value) for value in right)
        return matched if predicate == 'in' else not matched
    if predicate == 'eq':
        return scalar_equal(left, right)
    if predicate == 'ne':
        return not scalar_equal(left, right)
    if isinstance(left, bool) or isinstance(right, bool):
        raise TypeError('Boolean ordering is undefined')
    if predicate == 'gt': return left > right
    if predicate == 'gte': return left >= right
    if predicate == 'lt': return left < right
    if predicate == 'lte': return left <= right
    raise ValueError('Unsupported scalar predicate')


def valid_condition_value(predicate, value):
    if predicate in {'in', 'not_in'}:
        return isinstance(value, list) and 1 <= len(value) <= 50 and all(
            isinstance(item, (str, int, float, bool)) for item in value)
    return predicate in {'eq', 'ne', 'gt', 'gte', 'lt', 'lte'} and not isinstance(value, (dict, list))
