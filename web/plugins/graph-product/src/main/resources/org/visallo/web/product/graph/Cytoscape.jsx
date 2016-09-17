define([
    'react',
    'cytoscape',
    'fast-json-patch'
], function(
    React,
    cytoscape,
    jsonpatch) {

    const ANIMATION = { duration: 400, easing: 'spring(250, 20)' };
    const EVENTS = {
        drag: 'onDrag',
        free: 'onFree',
        grab: 'onGrab',
        position: 'onPosition',
        tap: 'onTap',
        pan: 'onPan',
        zoom: 'onZoom',
        change: 'onChange',
        select: 'onSelect',
        unselect: 'onUnselect'
    };

    const isEdge = data => (data.source !== undefined)
    const isNode = _.negate(isEdge)

    const Cytoscape = React.createClass({

        getDefaultProps() {
            const eventProps = _.mapObject(_.invert(EVENTS), () => () => {})
            return {
                ...eventProps,
                onReady() {},
                fit: false,
                config: {},
                elements: { nodes: [], edges: [] },
            }
        },

        componentDidMount() {
            const cy = cytoscape(this.prepareConfig());
            const stop = _.debounce(() => { this.userIsChangingViewport = false }, 50);
            cy.on('zoom pan', () => {
                cy.stop(true);
                this.userIsChangingViewport = true;
                stop();
            })
            this.setState({ cy })
        },

        componentWillUnmount() {
            if (this.state.cy) {
                this.state.cy.destroy();
            }
        },

        componentDidUpdate() {
            const { cy } = this.state;
            const newData = {elements: this.props.elements}
            const oldData = cy.json()
            const getAllData = nodes => nodes.map(({data, selected, position}) => ({
                data,
                selected,
                position
            }))
            const getTypeData = elementType => [oldData, newData].map(n => getAllData(n.elements[elementType] || []) )
            const [oldNodes, newNodes] = getTypeData('nodes')
            const [oldEdges, newEdges] = getTypeData('edges')

            if (this.previousConfig) {
                this.updateConfiguration(this.previousConfig, this.props.config);
            }
            this.previousConfig = this.props.config

            cy.batch(() => {
                this.makeChanges(oldNodes, newNodes)
                this.makeChanges(oldEdges, newEdges)
            })
        },

        prepareConfig() {
            const defaults = {
                container: this.refs.cytoscape,
                boxSelectionEnabled: true,
                ready: (event) => {
                    var { cy } = event,
                        eventMap = _.mapObject(EVENTS, (name, key) => (e) => {
                            if (this[key + 'Disabled'] !== true) {
                                this.props[name](e)
                            }
                        });
                    cy.on(eventMap)
                    this.props.onReady(event)
                }
            }
            var { config } = this.props;
            if (config) {
                console.log(config)
                return { ...defaults, ...config }
            }
            return defaults;
        },

        render() {
            return (
                <div style={{height: '100%'}} ref="cytoscape"></div>
            )
        },

        disableEvent(name, fn) {
            var names = name.split(/\s+/);
            names.forEach(name => (this[name + 'Disabled'] = true))
            fn.apply(this)
            names.forEach(name => (this[name + 'Disabled'] = false))
        },

        updateConfiguration(previous, { style, pan, zoom, ...other }) {
            const { cy } = this.state
            _.each(other, (val, key) => {
                if (!(key in previous) || previous[key] !== val) {
                    if (_.isFunction(cy[key])) {
                        cy[key](val)
                    } else console.warn('Unknown configuration key', key, val)
                }
            })

            this.disableEvent('pan zoom', () => {
                const eq = (a, b) => Math.abs(b - a) <= 0.001;
                var { x, y } = previous.pan
                if (!eq(x, pan.x) || !eq(y, pan.y) || !eq(previous.zoom, zoom)) {
                    if (this.userIsChangingViewport) {
                        console.log('setting', pan, zoom)
                        cy.viewport(zoom, pan)
                    } else {
                        cy.stop(true);
                        cy.animate({ pan, zoom }, { ...ANIMATION, queue: false })
                    }
                } else console.log('same viewport')
            });
        },

        makeChanges(older, newer) {
            const cy = this.state.cy
            const add = [];
            const remove = [...older];
            const modify = [];
            const oldById = _.indexBy(older, o => o.data.id);

            newer.forEach(item => {
                var id = item.data.id;
                var existing = oldById[id];
                if (existing) {
                    modify.push({ item, diffs: jsonpatch.compare(existing, item) })
                    var index = _.findIndex(remove, i => i.data.id === id);
                    if (index >= 0) remove.splice(index, 1)
                } else {
                    add.push(item)
                }
            })

            modify.forEach(({ item, diffs }) => {
                const topLevelChanges = _.indexBy(diffs, d => d.path.replace(/^\/([^\/]+).*$/, '$1'))
                Object.keys(topLevelChanges).forEach(change => {
                    const cyNode = cy.getElementById(item.data.id);

                    switch (change) {
                        case 'data':
                            cyNode.removeData()
                            cyNode.data(item.data)
                            break;
                        case 'selected':
                            if (cyNode.selected() !== item.selected) {
                                this.disableEvent('select unselect', () => cyNode[item.selected ? 'select' : 'unselect']());
                            }
                            break;
                        case 'position':
                            cyNode.animate({ position: item.position }, ANIMATION)
                            break;
                        default:
                            throw new Error('Change not handled: ' + change)
                    }
                })
            })
            add.forEach(item => {
                var { data } = item;

                if (isNode(data)) {
                    cy.add({ ...item, group: 'nodes' })
                } else if (isEdge(data)) {
                    cy.add({ ...item, group:'edges' })
                }
            })
            remove.forEach(item => {
                const cyNode = cy.getElementById(item.data.id);
                if (cyNode.length && !cyNode.removed()) {
                    cy.remove(cyNode)
                }
            })
        }
    })

    return Cytoscape;
})

