var Map = require('can/map/map');
var List = require('can/list/list');
var ComputeCollection = require('../compute-collection/compute-collection');
require('can/list/sort/sort');

List.prototype.filter = function (predicate) {

    // Derive a list of computes sorted by sourceKey
    var derived = new this.constructor();
    var computedCollection = new ComputeCollection(this);

    derived.attr('comparator', function (a, b) {
        a = a.sourceKey();
        b = b.sourceKey();
        return a === b ? 0 : a < b ? -1 : 1; // Ascending
    });

    // Bind to "key" because their value cannot naturally be `undefined`
    // like a "value" can. In other words, don't exclude an item because it's
    // "value" is `undefined`.
    computedCollection.bind('key', function (ev, newKey, oldKey, computes) {
        if (computes.key()) {

            // Add
            derived.push(computes);
        } else {
            derived.each(function (item, i) {

                // Remove
                if (item.sourceKey() === computes.sourceKey()) {
                    derived.splice(i, 1);
                    return false;
                }
            });
        }
    });

    // Since the keys of a filtered map are sometimes dependent on the values,
    // derive those first.
    computedCollection.attr('valueFn', function () { return arguments[0]; });

    // Return true/false to determine which keys are included/excluded in the
    // derived map
    computedCollection.attr('keyFn', predicate);

    return derived._filter();
};

List.prototype._filter = function () {
    var derived = new this.constructor();
    var computedCollection = new ComputeCollection(this);

    derived._source = this;

    computedCollection.bind('key', function (ev, newVal, oldVal, computes) {
        if (derived._isValidKey(oldVal) &&
                derived.attr(oldVal) === computes.value()) {
            console.log('Remove:', oldVal);
            derived.splice(oldVal, 1);
            console.log(derived.attr())
        }

        // If there's a valid key, and the item isn't already in the correct
        // position (as would be the case with a splice), add it.
        if (derived._isValidKey(newVal)
            && derived.attr(newVal) !== computes.value()) {

            console.log('Add:', newVal, '=', computes.value());
            derived.splice(newVal, 0, computes.value());
            console.log(derived.attr())
        }
    });

    computedCollection.bind('value', function (ev, newVal, oldVal, computes) {
        if (derived._isValidKey(computes.key())) {
            console.log('Update:', computes.key(), '=', computes.value());
            derived.attr(computes.key(), computes.value());
            console.log(derived.attr())
        }
    });

    computedCollection.attr('valueFn', function (computes, i) {
        return computes.value();
    });

    computedCollection.attr('keyFn', function (computes, sourceIndex) {
        return sourceIndex;
    });

    return derived;
};

module.exports = List;