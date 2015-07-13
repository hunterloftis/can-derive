var Map = require('can/map/map');
var List = require('can/list/list');
var ComputeCollection = require('../compute-collection/compute-collection');
var RedBlackTree = require('can-redblacktree').RBTree;

// Handle the adding/removing of items to the derived list based on
// the predicate
List.prototype.filter = function (predicate) {

    // Derive a list of computes sorted by sourceKey
    var derived = new this.constructor();
    var computedCollection = new ComputeCollection(this);
    var tree = new RedBlackTree(function (a, b) {
        a = a.sourceKey();
        b = b.sourceKey();
        return a === b ? 0 : a < b ? -1 : 1; // Ascending
    });

    // NOTE: Bind to "key" because their value cannot naturally be `undefined`
    // like a "value" can. In other words, don't exclude an item because it's
    // "value" is `undefined`.
    computedCollection.bind('key', function (ev, newKey, oldKey, computes) {
        var insertIndex, removeIndex;

        // The "key" will either be true or false per the rules of the predicate
        // so we only need to handle add/remove (not a change in index)
        // TODO: Handle a change in index
        if (computes.key()) {

            // Get the index to insert at
            insertIndex = tree.insert(computes);

            // Insert
            if (insertIndex >= 0) {
                derived.splice(insertIndex, 0, computes.value());
            }
        } else {
            removeIndex = tree.remove(computes);

            // Remove
            if (removeIndex >= 0) {
                derived.splice(removeIndex, 1);
            }
        }
    });

    computedCollection.bind('value',
        function (ev, newValue, oldValue, computes) {
            var changedIndex = tree.findIndex(computes);

            if (changedIndex < 0) {
                return;
            }

            if (derived.attr(changedIndex) === oldValue) {
                derived.attr(changedIndex, newValue);
            }
        });

    // Use the existing values
    computedCollection.attr('valueFn', function (value) {
        return value;
    });

    // Return true/false to determine which keys are included/excluded in the
    // derived map
    computedCollection.attr('keyFn', predicate);

    return derived;
};

module.exports = List;