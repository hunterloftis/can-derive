/*list/list*/
define(function (require, exports, module) {
    var RBTreeList = require('can-binarytree').RBTreeList;
    require('can/list');
    require('can/compute');
    require('can/util');
    var __observe = can.__observe;
    var __observeAbstractValues = false;
    var _triggerChange, __observeException, __predicateObserve, DerivedList, FilteredList, DerivableList, ObservedPredicate;
    _triggerChange = can.Map.prototype._triggerChange;
    can.Map.prototype._triggerChange = function (attr, how, newVal, oldVal) {
        _triggerChange.apply(this, arguments);
        can.batch.trigger(this, {
            type: '__modified',
            target: this
        }, [
            newVal,
            oldVal
        ]);
    };
    __predicateObserve = function (obj, event) {
        if (obj === __observeException) {
            return;
        }
        if (__observeAbstractValues && !(obj instanceof can.List) && obj instanceof can.Map) {
            event = '__modified';
        }
        return __observe.call(this, obj, event);
    };
    DerivedList = RBTreeList.extend({
        _indexBound: false,
        filter: function (predicate, predicateContext) {
            var context = this;
            var filteredList;
            can.__notObserve(function () {
                if (!context._derivedList) {
                    context._derivedList = new DerivedList(context);
                }
                filteredList = new FilteredList(context._derivedList, predicate, predicateContext);
                if (!context._derivedList._indexBound && filteredList._indexBound) {
                    context._derivedList._indexBound = true;
                }
            })();
            return filteredList;
        },
        setup: function () {
            var setupResult = RBTreeList.prototype.setup.apply(this, arguments);
            if (this.___get) {
                this.___get = this.____get;
            } else {
                this.__get = this.____get;
            }
            return setupResult;
        },
        init: function (sourceList, initializeWithoutItems) {
            var self = this;
            var initArgs = [];
            var initializeWithItems = !initializeWithoutItems;
            this._source = sourceList;
            if (initializeWithItems) {
                var initialItems = [];
                can.each(sourceList, function (value, index) {
                    initialItems[index] = self.describeSourceItem(value, index);
                });
                initArgs[0] = initialItems;
                initArgs[1] = function (index, node) {
                    initialItems[index].node = node;
                };
            }
            RBTreeList.prototype.init.apply(this, initArgs);
            this.syncAdds(!initializeWithItems);
            this.syncRemoves();
            this.syncValues();
        },
        syncAdds: function (addInitialItems) {
            var self = this;
            if (addInitialItems) {
                this.addItems(this._source, 0);
            }
            this._source.bind('add', function (ev, items, offset) {
                self.addItems(items, offset);
            });
        },
        syncRemoves: function () {
            var self = this;
            this._source.bind('remove', function (ev, items, offset) {
                self.removeItems(items, offset);
            });
        },
        syncValues: function () {
            var tree = this;
            var ___set = this._source.___set;
            this._source.___set = function (index, value) {
                var node = tree.get(index);
                if (node) {
                    node.data.index = index;
                    node.data.value = value;
                    can.batch.trigger(tree, '__nodeModified', [node]);
                }
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
            var context = this;
            var sourceItem = this.describeSourceItem.apply(this, arguments);
            var node;
            can.batch.start();
            node = this.set(insertIndex, sourceItem, true);
            sourceItem.node = node;
            can.batch.stop();
            can.batch.afterPreviousEvents(function () {
                context._propagateIndexShift(insertIndex + 1);
            });
        },
        describeSourceItem: function (item, insertIndex) {
            var tree = this;
            var sourceItem = {};
            sourceItem.index = insertIndex;
            sourceItem.value = item;
            if (item.bind) {
                item.bind('__modified', function () {
                    can.batch.trigger(tree, '__nodeModified', [sourceItem.node]);
                });
            }
            return sourceItem;
        },
        _propagateIndexShift: function (affectedIndex) {
            var i, node;
            if (this._indexBound) {
                i = affectedIndex;
                node = this.get(i);
                while (node) {
                    node.data.index = i;
                    can.batch.trigger(this, '__nodeModified', [node]);
                    node = node.next;
                    i++;
                }
            }
        },
        removeItems: function (items, offset) {
            var index = (items.length && items.length - 1) + offset;
            while (index >= offset) {
                this.removeItem(items[index], index);
                index--;
            }
        },
        removeItem: function (item, removedIndex) {
            this.unset(removedIndex, true);
            this._propagateIndexShift(removedIndex);
        },
        push: can.noop,
        pop: can.noop,
        shift: can.noop,
        unshift: can.noop,
        splice: can.noop,
        _printIndexesValue: function (node) {
            return node.data.value;
        }
    });
    FilteredList = DerivedList.extend({
        init: function (sourceList, predicate, predicateContext) {
            this._includeComputes = [];
            if (predicate) {
                this.predicate = can.proxy(predicate, predicateContext || this);
            }
            if (predicate.length > 1) {
                this._indexBound = true;
            }
            this._normalizeComparatorValue = this._getNodeIndexFromSource;
            DerivedList.prototype.init.apply(this, [
                sourceList,
                true
            ]);
        },
        syncValues: function () {
            this._source.bind('__nodeModified', can.proxy(this._evaluateIncludeComputeManually, this));
        },
        _evaluateIncludeComputeManually: function (ev, node) {
            var sourceData = node.data;
            var includeCompute = this._includeComputes[sourceData.index];
            if (!includeCompute) {
                return;
            }
            var oldValue = includeCompute.get();
            var newValue;
            includeCompute._on();
            newValue = includeCompute.get();
            if (newValue === oldValue) {
                return;
            }
            can.batch.trigger(includeCompute, {
                type: 'change',
                batchNum: can.batch.batchNum
            }, [
                newValue,
                oldValue
            ]);
        },
        syncRemoves: function () {
            var self = this;
            this._source.bind('pre-remove', function (ev, items, offset) {
                self.removeItems(items, offset);
            });
        },
        _gapAndSize: function () {
            this.length++;
        },
        _comparator: function (_a, _b) {
            var a = this._normalizeComparatorValue(_a);
            var b = this._normalizeComparatorValue(_b);
            return a === b ? 0 : a < b ? -1 : 1;
        },
        _normalizeComparatorValue: function () {
            throw new Error('A method must be provided to normalize comparator values');
        },
        _getNodeIndexFromSource: function (value) {
            return value instanceof this.Node ? this._source.indexOfNode(value.data.node) : value;
        },
        _getNodeIndexFromSelf: function (value) {
            return value instanceof this.Node ? this.indexOfNode(value) : value;
        },
        predicate: function () {
            return true;
        },
        addItem: function (node) {
            var self = this;
            var nodeValue = node.data;
            var observedPredicate = new ObservedPredicate(this.predicate, this._source._source, nodeValue);
            var includeCompute = observedPredicate.includeCompute;
            this._includeComputes.splice(nodeValue.index, 0, includeCompute);
            includeCompute.bind('change', function (ev, newVal) {
                self._applyPredicateResult(nodeValue, newVal);
            });
            var res = includeCompute.get();
            if (res) {
                this._applyPredicateResult(nodeValue, true);
            }
        },
        _applyPredicateResult: function (nodeValue, include) {
            var sourceIndex = this._source.indexOfNode(nodeValue.node);
            if (include) {
                this.set(sourceIndex, nodeValue, true);
            } else {
                this.unset(sourceIndex, true);
            }
        },
        removeItem: function (item, sourceIndex) {
            this.unset(sourceIndex, true);
            this._includeComputes.splice(sourceIndex, 1);
        },
        each: function (callback) {
            RBTreeList.prototype.each.call(this, function (node, i) {
                return callback(node.data.value, i);
            });
        },
        ____get: function () {
            this._normalizeComparatorValue = this._getNodeIndexFromSelf;
            var result = RBTreeList.prototype.____get.apply(this, arguments);
            this._normalizeComparatorValue = this._getNodeIndexFromSource;
            if (result && typeof result === 'object' && 'value' in result) {
                result = result.value;
            }
            return result;
        },
        _triggerChange: function (attr, how, newVal, oldVal) {
            var nodeConstructor = this.Node;
            can.each([
                newVal,
                oldVal
            ], function (newOrOldValues) {
                can.each(newOrOldValues, function (value, index) {
                    if (value instanceof nodeConstructor) {
                        newOrOldValues[index] = value.data.value;
                    }
                });
            });
            RBTreeList.prototype._triggerChange.apply(this, arguments);
        }
    });
    ObservedPredicate = function (predicate, sourceCollection, nodeValue) {
        this.predicate = predicate;
        this.nodeValue = nodeValue;
        this.sourceCollection = sourceCollection;
        this.includeCompute = new can.Compute(this.includeFn, this);
    };
    ObservedPredicate.prototype.includeFn = function () {
        var include, index, sourceCollection, value;
        index = this.nodeValue.index;
        value = this.nodeValue.value;
        sourceCollection = this.sourceCollection;
        __observeAbstractValues = true;
        __observeException = value;
        can.__observe = __predicateObserve;
        include = this.predicate(value, index, sourceCollection);
        __observeAbstractValues = false;
        __observeException = undefined;
        can.__observe = __observe;
        return include;
    };
    DerivableList = can.List.extend({ filter: DerivedList.prototype.filter });
    if (typeof window !== 'undefined' && !require.resolve && window.can) {
        if (!window.can.derive) {
            window.can.derive = {};
        }
        can.derive.List = DerivableList;
    }
    module.exports = DerivableList;
});