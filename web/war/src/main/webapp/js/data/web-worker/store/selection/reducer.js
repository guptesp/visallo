define([], function() {
    'use strict';

    return function selection(state, { type, payload }) {
        if (!state) return { idsByType: { vertices: [], edges: [] } };

        switch (type) {
            case 'SELECTION_ADD': return { ...state, idsByType: add(state.idsByType, payload) };
            case 'SELECTION_REMOVE': return { ...state, idsByType: remove(state.idsByType, payload) };
            case 'SELECTION_CLEAR': return { ...state, idsByType: clear(state.idsByType) }
        }

        return state
    }


    function add(previous, { selection }) {
        return _update(previous, selection,
            (previousIds) => id => !previousIds.includes(id),
            (previousIds, list) => _.unique([...list, ...previousIds]).sort()
        );
    }

    function remove(previous, { selection }) {
        return _update(previous, selection,
            (previousIds) => id => previousIds.includes(id),
            (previousIds, list) => _.without(previousIds, ...list)
        );
    }

    function _update(previous, selection, predicate, action) {
        console.log('update', selection)
        var changed = false,
            updated = _.mapObject(previous, function(previousIds, type) {
                var list = selection[type];
                if (list && _.any(list, predicate(previousIds))) {
                    changed = true
                    return action(previousIds, list)
                }
                return previousIds
            })

        console.log('changed?', changed, updated, previous)
        return changed ? updated : previous
    }

    function clear(previous) {
        var changed = false,
            updated = _.mapObject(previous, function(ids, type) {
                if (ids.length) {
                    changed = true
                    return [];
                }
                return ids
            })

        return changed ? updated : previous
    }

})


