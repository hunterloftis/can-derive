var List = require('can/list/list');
var RBTreeList = require('can-binarytree').RBTreeList;
var DerivedList, FilteredList;

require('can/compute/compute');
require('can/util/util');

// Use a tree so that items are sorted by the source list's
// index in O(log(n)) time
DerivedList = RBTreeList.extend({

    // A flag that determines if index influencing operations like shift
    // and splice should result in O(n) index compute updates
    _indexBound: false,

    filter: function (predicate, predicateContext) {
        if (! this._derivedList) {
            this._derivedList = new DerivedList(this);
        }

        var filteredList =
            new FilteredList(this._derivedList, predicate, predicateContext);

        // Set _indexBound to true if this filtered list depends on the
        // index. Once set to true there's no going back.
        if (! this._derivedList._indexBound && filteredList._indexBound) {
            this._derivedList._indexBound = true;
        }

        return filteredList;
    },

    init: function (sourceList, initializeWithoutItems) {

        var self = this;
        var initArgs = [];
        var initializeWithItems = !initializeWithoutItems;

        // Save a reference to the list we're deriving
        this._source = sourceList;

        // Don't populate the tree with the items initially passed
        // to the constructor
        if (initializeWithItems) {
            var initialItems = [];

            can.each(sourceList, function (value, index) {
                initialItems[index] = self.convertItemToCompute(value, index);
            });

            initArgs[0] = initialItems;
            initArgs[1] = function (index, node) {
                initialItems[index].node = node;
            }
        }

        // Setup the tree
        RBTreeList.prototype.init.apply(this, initArgs);

        // Make this list a reflection of the source list
        this.syncAdds(! initializeWithItems);
        this.syncRemoves();
        this.syncValues();
    },

    syncAdds: function (addInitialItems) {

        var self = this;

        if (addInitialItems) {
            // Add initial items
            this._source.each(function (item, index) {
                self.addItem(item, index);
            });
        }

        // Add future items
        this._source.bind('add', function (ev, items, offset) {
            self.addItems(items, offset);
        });
    },

    syncRemoves: function () {

        var self = this;

        // Remove future items
        this._source.bind('remove', function (ev, items, offset) {
            self.removeItems(items, offset);
        });
    },

    syncValues: function () {

        var self = this;

        // Handle future changes in value to existing items
        var ___set = this._source.___set;
        this._source.___set = function (index, value) {

            // Get a reference to the "computes" object
            var computes = self.get(index).data;

            if (computes) {
                // Update the value, thus triggering a `change` event
                computes.value(value);
            }

            // Continue the `set` on the source list
            return ___set.apply(this, arguments);
        };
    },

    addItems: function (items, offset) {
        var self = this;

        can.each(items, function (item, i) {
            self.addItem(item, offset + i);
        });
    },

    addItem: function (item, insertIndex) {
        var node;

        var computes = this.convertItemToCompute.apply(this, arguments);

        // Don't dispatch the resulting "add" event until a reference
        // to the node has been saved to the `computes` object
        can.batch.start();
        node = this.set(insertIndex, computes, true);
        computes.node = node;
        can.batch.stop();

        this.propagateIndexAdjustment(insertIndex + 1);
    },

    convertItemToCompute: function (item, insertIndex) {
        // Store information in a way that changes can be bound to
        var computes = {};
        computes.index = can.compute(insertIndex);
        computes.value = can.compute(item);
        return computes;
    },

    propagateIndexAdjustment: function (affectedIndex) {

        var i, node;

        // When the `_indexBound` flag is true that means that a predicate
        // function of one of the filtered lists that use this derived list
        // as their source is bound to the index. This is unfortunate,
        // because now we have to manually update a compute that stores the
        // index so that the filtered list that is bound to the index can
        // re-run its predicate function for all of the items whos indices
        // have changed. Which of course now makes this an O(n) filter. And
        // worse, this will apply to the  filtered lists that don't depend
        // on the index too!
        if (this._indexBound) {

            i = affectedIndex;
            node = this.get(i);

            // Iterate using the linked-list, it's faster than
            // for (i) { this.get(i); }
            while (node) {
                node.data.index(i);
                node = node.next;
                i++;
            }
        }
    },

    removeItems: function (items, offset) {
        var self = this;

        // Remove each item
        can.each(items, function (item, i) {
            var index = offset + i;
            self.removeItem(item, index);
        });
    },

    removeItem: function (item, removedIndex) {
        this.unset(removedIndex, true);
        this.propagateIndexAdjustment(removedIndex);
    },

    // Derived/filtered aren't writeable like traditional lists, they're
    // values are maintained via event bindings
    push: can.noop,
    pop: can.noop,
    shift: can.noop,
    unshift: can.noop,
    splice: can.noop,

    _printIndexesValue: function (node) {
        return node.data.value();
    }
});

// Handle the adding/removing of items to the derived list based on
// the predicate
FilteredList = DerivedList.extend({

    init: function (sourceList, predicate, predicateContext) {

        // Overwrite the default predicate if one is provided
        if (predicate) {
            this.predicate = can.proxy(predicate, predicateContext || this);
        }

        // Mark this derived list as bound to indexes
        if (predicate.length > 1) {
            this._indexBound = true;
        }

        // Set the default comparator value normalize method to use
        // the source tree
        this._normalizeComparatorValue = this._getNodeIndexFromSource;

        // Setup bindings, initialize the tree (but don't populate the tree
        // with the items passed to the constructor)
        DerivedList.prototype.init.apply(this, [sourceList, true]);
    },

    // A filtered list's source list is a derived list (the derived list stores
    // all of the potential values) who's values are computes that are kept
    // in sync with the derived list's source list for us
    syncValues: can.noop,

    syncRemoves: function () {

        var self = this;

        // Remove future items
        this._source.bind('pre-remove', function (ev, items, offset) {
            self.removeItems(items, offset);
        });
    },


    // Disable gaps in indexes
    _gapAndSize: function () {
        this.length++;
    },

    _comparator: function (_a, _b) {
        var a = this._normalizeComparatorValue(_a);
        var b = this._normalizeComparatorValue(_b);
        return a === b ? 0 : a < b ? -1 : 1; // ASC
    },

    _normalizeComparatorValue: function () {
        throw new Error(
            'A method must be provided to normalize comparator values');
    },

    // Use a function that refers to this tree when the comparator
    // is passed a node
    _getNodeIndexFromSource: function (value) {
        return value instanceof this.Node ?
            this._source.indexOfNode(value.data.node) :
            value;
    },

    // Use a function that refers to the source tree when the comparator
    // is passed a node
    _getNodeIndexFromSelf: function (value) {
        return value instanceof this.Node ?
            this.indexOfNode(value) :
            value;
    },

    // By default, include all items
    predicate: function () { return true; },

    // Bind to index/value and determine whether to include/exclude the item
    // based on the predicate function provided by the user
    addItem: function (node) {
        var self = this;
        var computes = node.data;

        // Default to false
        var initialized = can.compute(false);

        // Determine whether to include or not
        var include = can.compute(function () {

            var index, sourceCollection, value;

            // Ensure first change event's "oldVal" is `false`
            if (! initialized()) { return false; }

            value = computes.value();
            sourceCollection = this._source._source;

            // If the user has provided a predicate function that depends
            // on the index argument, bind to it directly; Everything's O(n)
            // from here on out (for this particular derived list)
            if (this._indexBound) {
                index = computes.index();
            }

            // If the user has provided a predicate function that depends
            // on the source collection, bind to length changes so that
            // the `include` compute will be re-evaluated
            if (this.predicate.length > 2) {
                sourceCollection.attr('length');
            }

            // Use the predicate function to determine if this
            // item should be included in the overall list
            return this.predicate(value, index, sourceCollection);
        }, this);

        // Add/remove based predicate change
        include.bind('change', function (ev, newVal, oldVal) {
            var sourceIndex = self._source.indexOfNode(computes.node);

            if (newVal) {
                self.set(sourceIndex, computes, true);
            } else {
                self.unset(sourceIndex, true);
            }
        });

        // Trigger an "include" `change` event
        initialized(true);
    },

    removeItem: function (item, sourceIndex) {
        this.unset(sourceIndex, true);
    },

    // Iterate over the value computes' values instead of the node's data
    each: function (callback) {
        RBTreeList.prototype.each.call(this, function (node, i) {
            return callback(node.data.value(), i);
        });
    },


    ___get: function () {

        // Compare the passed index against the index of items in THIS tree
        this._normalizeComparatorValue = this._getNodeIndexFromSelf;

        var result = RBTreeList.prototype.___get.apply(this, arguments);

        // Revert back to the default behavior, which is to compare the passed
        // index against the index of items in the SOURCE tree
        this._normalizeComparatorValue = this._getNodeIndexFromSource;

        if (result instanceof this.Node) {
            result = result.data.value();
        }
        return result;
    },

    // The default RBTreeList add/remove/pre-remove events pass the Node
    // as the newVal/oldVal, but the derived list is publicly consumed by
    // lots of things that think it's can.List-like; Instead dispatch the
    // event with the Node's "value" compute value
    _triggerChange: function (attr, how, newVal, oldVal) {
        var nodeConstructor = this.Node;

        // Modify existing newVal/oldVal arrays values
        can.each([newVal, oldVal], function (newOrOldValues) {
            can.each(newOrOldValues, function (value, index) {
                if (value instanceof nodeConstructor) {
                    newOrOldValues[index] = value.data.value();
                }
            });
        });

        // Emit the event without any Node's as new/old values
        RBTreeList.prototype._triggerChange.apply(this, arguments);
    }
});

// Overwrite the default `.filter()` method with our derived list filter
// method
var FilterPluginList = List.extend({
    filter: DerivedList.prototype.filter
});

if (typeof window !== 'undefined' && !require.resolve && window.can) {
    window.can.DeriveList = FilterPluginList;
}

module.exports = FilterPluginList;