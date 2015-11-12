var QUnit = require("steal-qunit");
var List = require("./list");

QUnit.module('.filter()', {
    setup: function () {}
});

var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var dirtyAlphabet = letters.split('');
dirtyAlphabet.splice(2, 0, 0);
dirtyAlphabet.splice(5, 0, 0);
dirtyAlphabet.splice(12, 0, 0);
dirtyAlphabet.splice(16, 0, 0);
dirtyAlphabet.splice(22, 0, 0);
dirtyAlphabet.splice(27, 0, 0);

var equalValues = function (list, expectedValues) {
    var match = true;

    if (list.length !== expectedValues.length) {
        return false;
    }

    list.each(function (item, index) {
        if (item !== expectedValues[index]) {
            match = false;
        }
    });

    return match;
};

test('Method exists', function () {
    ok(List.prototype.filter, 'List has filter method');
});

test('The predicate function re-evaluates when a source item changes', function () {

    var values = [true, true, true];

    var source = new List(values);
    var predicateFn = function (item) {
        return item
    }
    var derived = source.filter(predicateFn);

    equal(derived.attr('length'), 3, 'Initial length is correct');

    derived.predicate = function () {
        ok(true, 'Predicate should be run for source changes')
        return predicateFn.apply(this, arguments);
    }

    source.attr(1, false);

    equal(derived.attr('length'), 2, 'Item removed after source change');
});

test('Derives initial values', function () {

    var filterFn = function (value, index) { return value ? true : false; };
    var source = new List(dirtyAlphabet);
    var expected = dirtyAlphabet.filter(filterFn);
    var derived = source.filter(filterFn);

    ok(equalValues(derived, expected), 'Initial values are correct');
});

test('Changes to source list are synced to their derived list', function () {

    var alphabet = dirtyAlphabet.slice();
    var filterFn = function (value) { return value ? true : false; };
    var source = new List(alphabet);

    var derived = source.filter(filterFn);
    var expected;

    source.attr(4, 'DD'); // D -> DD
    alphabet[4] = 'DD'; // Update static list
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Set derived'); // Compare

    source.attr(10, 'II'); // I -> II
    alphabet[10] = 'II';
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Set derived');

    source.attr(29, 'XX'); // X -> XX
    alphabet[29] = 'XX';
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Set derived');
});

test('Items added to a source list get added to their derived list', function () {

    var alphabet = dirtyAlphabet.slice();
    var filterFn = function (value) { return value ? true : false; };
    var source = new List(alphabet);
    var derived = source.filter(filterFn);
    var expected;

    derived.bind('add', function (ev, items, offset) {
        items.forEach(function (item, index) {
            equal(item, expected[offset + index],
                'Add event reports correct value/index');
        });
    });

    // Insert before
    alphabet.unshift('Aey');
    expected = alphabet.filter(filterFn);
    source.unshift('Aey');

    ok(equalValues(derived, expected), 'Item added via .unshift()');

    // Insert between
    alphabet.splice(20, 0, 'Ohh');
    expected = alphabet.filter(filterFn);
    source.splice(20, 0, 'Ohh');

    ok(equalValues(derived, expected), 'Item added via .splice()');

    // Insert after
    alphabet.push('Zee');
    expected = alphabet.filter(filterFn);
    source.push('Zee');

    ok(equalValues(derived, expected), 'Item added via .push()');
});

test('Items removed from a source list are removed from their derived list', function () {
    var alphabet = dirtyAlphabet.slice();
    var filterFn = function (value) { return value ? true : false; };
    var source = new List(alphabet);
    var derived = source.filter(filterFn);
    var expected;

    // Remove first
    source.shift();
    alphabet.shift();
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Item removed via .shift()');

    // Remove middle
    source.splice(10, 1);
    alphabet.splice(10, 1);
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Item removed via .splice()');

    // Remove last
    source.pop();
    alphabet.pop();
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Item removed via .pop()');
});

test('Predicate function can be bound to source index', function () {
    var alphabet = dirtyAlphabet.slice();
    var filterFn = function (value, index) { return index % 2 === 0; };
    var source = new List(alphabet);
    var derived = source.filter(filterFn);
    var expected = alphabet.filter(filterFn);

    // Initial values
    ok(equalValues(derived, expected), 'Odd indexed items excluded');

    // Insert at the beginning
    source.unshift(true);
    alphabet.unshift(true);
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Items are flopped after an insert at the beginning');

    // Remove from the beginning
    source.shift();
    alphabet.shift();
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Items are flopped after a remove at the beginning');

    // Insert at the middle
    source.splice(10, 0, '10A');
    alphabet.splice(10, 0, '10A');
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Segment of items are flopped after an insert (in the middle)');

    // Remove from the middle
    source.splice(11, 1);
    alphabet.splice(11, 1);
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Segment of items are flopped after a remove (in the middle)');

    // Replace in the middle
    source.splice(10, 1, '10B');
    alphabet.splice(10, 1, '10B');
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Items are mostly unchanged after a replace');

    // Add at the end
    source.push('ZZZ');
    alphabet.push('ZZZ');
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Item is added at the end');

    // Remove at the end
    source.pop();
    alphabet.pop();
    expected = alphabet.filter(filterFn);

    ok(equalValues(derived, expected), 'Item is removed from the end');

});

test('Can derive a filtered list from a filtered list', function () {
    var letterCollection = [];
    var total = 4; // 40, because it's evenly divisible by 4

    // Generate values
    for (var i = 0; i < total; i++) {
        letterCollection.push(letters[i]);
    }

    // Half filters
    var makeFilterFn = function (predicate) {
        return function (value, index, collection) {

            // Handle can.List's and native Array's
            var length = collection.attr ?
                collection.attr('length') :
                collection.length;

            var middleIndex = Math.round(length / 2);

            return predicate(index, middleIndex);
        };
    };

    var firstHalfFilter = makeFilterFn(function (a, b) { return a < b; });
    var secondHalfFilter = makeFilterFn(function (a, b) { return a >= b; });

    var source = new List(letterCollection);

    // Filter the whole collection into two separate lists
    var derivedFirstHalf = source.filter(firstHalfFilter);
    var derivedSecondHalf = source.filter(secondHalfFilter);

    // Filter the two lists into four additional lists
    var derivedFirstQuarter = derivedFirstHalf.filter(firstHalfFilter);
    var derivedSecondQuarter = derivedFirstHalf.filter(secondHalfFilter);
    var derivedThirdQuarter = derivedSecondHalf.filter(firstHalfFilter);
    var derivedFourthQuarter = derivedSecondHalf.filter(secondHalfFilter);

    var evaluate = function () {
        // Recreate the halfed/quartered lists using native .filter()
        var expectedFirstHalf = letterCollection.filter(firstHalfFilter);
        var expectedSecondHalf = letterCollection.filter(secondHalfFilter);
        var expectedFirstQuarter = expectedFirstHalf.filter(firstHalfFilter);
        var expectedSecondQuarter = expectedFirstHalf.filter(secondHalfFilter);
        var expectedThirdQuarter = expectedSecondHalf.filter(firstHalfFilter);
        var expectedFourthQuarter = expectedSecondHalf.filter(secondHalfFilter);

        ok(equalValues(derivedFirstHalf, expectedFirstHalf), '1st half matches expected');
        ok(equalValues(derivedSecondHalf, expectedSecondHalf), '2nd half matches expected');
        ok(equalValues(derivedFirstQuarter, expectedFirstQuarter), '1st quarter matches expected');
        ok(equalValues(derivedSecondQuarter, expectedSecondQuarter), '2nd quarter matches expected');
        ok(equalValues(derivedThirdQuarter, expectedThirdQuarter), '3rd quarter matches expected');
        ok(equalValues(derivedFourthQuarter, expectedFourthQuarter), '4th quarter matches expected');
    };

    // Initial values
    evaluate();

    // Insert
    source.push(letters[total]);
    letterCollection.push(letters[total]);
    evaluate();

    // Remove
    source.shift();
    letterCollection.shift();
    evaluate();
});

test('Derived list fires add/remove/length events', function () {
    var filterFn = function (value, index) {
        return value ? true : false;
    };
    var alphabet = dirtyAlphabet.slice();
    var source = new List(dirtyAlphabet);
    var expected = alphabet.filter(filterFn);
    var derived = source.filter(filterFn);

    derived.bind('add', function (ev, added, offset) {
        ok(true, '"add" event fired');
        // NOTE: Use deepEqual to compare values, not list instances
        deepEqual(added, ['ZZ'], 'Correct newVal passed to "add" handler');
    });

    derived.bind('remove', function (ev, removed, offset) {
        ok(true, '"remove" event fired');
        // NOTE: Use deepEqual to compare values, not list instances
        deepEqual(removed, ['D'], 'Correct oldVal passed to "remove" handler');
    });

    derived.bind('length', function (ev, newVal) {
        ok('"length" event fired');
        equal(newVal, expected.length, 'Correct newVal passed to "length" handler');
    });

    // Add
    alphabet.splice(alphabet.length - 1, 0, 'ZZ');
    expected = alphabet.filter(filterFn);
    source.splice(source.length - 1, 0, 'ZZ');

    // Remove
    alphabet.splice(4, 1);
    expected = alphabet.filter(filterFn);
    source.splice(4, 1);
});

test('Can iterate initial values with .each()', function () {
    var filterFn = function (value, index) {
        return value ? true : false;
    };
    var source = new List(dirtyAlphabet);
    var expected = dirtyAlphabet.filter(filterFn);
    var derived = source.filter(filterFn);

    derived.each(function (value, index) {
        equal(value, expected[index], 'Iterated value matches expected value');
    });
});

test('.attr([index]) returns correct values', function () {
    var filterFn = function (value, index) {
        return value ? true : false;
    };
    var source = new List(dirtyAlphabet);
    var expected = dirtyAlphabet.filter(filterFn);
    var derived = source.filter(filterFn);

    expected.forEach(function (expectedValue, index) {
        equal(derived.attr(index), expectedValue, 'Read value matches expected value');
    });
});

test('Predicate function can be passed an object and call a function', function () {
    var source = new List();
    var predicateFn = function (value) {
      var result = value.fullName() === FILTERED_VALUE.fullName();
      return result;
    }

    for (var i = 0; i < 10; i++) {
      var value = new can.Map({
        id: i.toString(16),
        firstName: 'Chris',
        lastName: 'Gomez',
        fullName: function () {
          return this.attr('firstName') + ' ' + this.attr('lastName') +
            '_' + this.attr('id');
        }
      });
      source.push(value);
    }
    var FILTERED_VALUE = value;

    var derived = source.filter(predicateFn);

    equal(derived.attr('length'), 1, 'Length is correct after initial filter');

    source.attr(0, FILTERED_VALUE);

    equal(derived.attr('length'), 2, 'Length is correct after set');

    source.attr('5.id', FILTERED_VALUE.id);

    equal(derived.attr('length'), 3, 'Length is correct after change');
});

test('Get value at index using attr()', function () {
    var source = new List(['a', 'b', 'c']);
    var derived = source.filter(function () {
        return true;
    });

    equal(derived.attr(0), 'a', 'Got value using .attr()');
    equal(derived.attr(1), 'b', 'Got value using .attr()');
    equal(derived.attr(2), 'c', 'Got value using .attr()');
});
