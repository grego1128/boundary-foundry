/**
 * @fileOverview This file provides support for applications using osmcore.js
 * @author Greg ONeill
 * @version 0.8
 */

// Help for JSLint
// prototype.js globals...
/*global Class $A */
/*global ArrayIterator ArraySectionIterator */

/**
 Represents OsmWay endpoint (of waynodes) including bbox (at click pt)
 * @class 
 * @property {OsmWay} osmWay The Way for this endpoint 
 * @property {OsmWay} index The waynode index for this endpoint 
 * @property {OsmWay} bbox The bbox that encloses this endpoint 
 **/
var OsmWayEndpoint = Class.create(
/** @scope OsmWayEndpoint.prototype */
{
  /** 
   *  @constructs
   *  @param osmWay Way for this endpoint
   *  @param index Index into the osmWay.wayNodes for this endpoint   
   */
  initialize: function (/**OsmWay*/ osmWay, /**Number*/ index) {
    this.osmWay = osmWay;
    this.index = index;
    this.bbox = undefined;
  },
  /** 
   *  Set the bbox and updates the index if necessary
   *  @param bbox Update the endpoint if the bbox encloses either end of the Way
   */
  updateWithBbox: function (/**OsmBbox*/ bbox) {
    var latLon = this.osmWay.getLatLonAtIndex(0); // check 1st index
    if (bbox.enclosesLatLon(latLon)) {
      this.index = 0;
      this.bbox = bbox;
    } else {
      var index = this.osmWay.wayNodes.length - 1;
      latLon = this.osmWay.getLatLonAtIndex(index); // check last index
      if (bbox.enclosesLatLon(latLon)) {
        this.index = index;
        this.bbox = bbox;
      }
    }
  },
  /** 
   *  Returns the LatLon for the this.index
   *  @returns {LatLon} LatLon for the this.index    
   */
  getLatLon: function () {
    return this.osmWay.getLatLonAtIndex(this.index);
  }
}); // --OsmWayEndpoint

/**
 * @description Records the distance between the current position of the 2 osm way iterators
 * @class 
 * @property {Number} distance Latitude of point  
 * @property {OsmWayEndpointIterator} Iterator1 of 2 intersecting ways  
 * @property {OsmWayEndpointIterator} Iterator2 of 2 intersecting ways
 **/
var WayNodeDistance = Class.create(
/** @scope WayNodeDistance.prototype */
{
  /** @constructs */
  initialize: function () {
    this.distance = 0;
    this.iterator1 = undefined;
    this.iterator2 = undefined;
  },
  /** 
   *  description
   *  @param name description
   *  @returns {type} description    
   */
  fillByEndpointIterators: function (
      /**OsmWayEndpointIterator*/ iterator1, 
      /**OsmWayEndpointIterator*/ iterator2) {
    this.iterator1 = iterator1;
    this.iterator2 = iterator2;
    this.currIndex1 = iterator1.currIndex;
    this.currIndex2 = iterator2.currIndex;
    
    var latLon1 = iterator1.current().getLatLon();
    var latLon2 = iterator2.current().getLatLon();
    this.distance = latLon1.distancePythagorean(latLon2);
  }
}); // --WayNodeDistance

/**
 * Use to iterate a way defined by the endpoint
 * @class 
 * @extends ArraySectionIterator
 * @property {OsmWayEndpoint} Endpoint representing way to be iterated
 **/
var OsmWayEndpointIterator = Class.create(ArraySectionIterator,
/** @scope OsmWayEndpointIterator.prototype */
{
  /** 
   *  @constructs   
   *  @param $super Reference to constructor for {@link ArraySectionIterator}  
   *  @param osmWayEndpoint Iterate this.osmWayEndpoint.way.waynodes 
   */
  initialize: function (/**Function*/ $super, /**OsmWayEndpoint*/ osmWayEndpoint) {
    this.osmWayEndpoint = osmWayEndpoint;
    
    var wayNodes = osmWayEndpoint.osmWay.wayNodes;
    var startIndex = osmWayEndpoint.index;
    var lastIndex = 0;
    if (startIndex === 0) {
      lastIndex = wayNodes.length - 1;
    }
    
    $super(wayNodes, startIndex, lastIndex);
  }
}); // --OsmWayEndpointIterator

/**
 * @description Used to iterate around the waynodes of a boundary defined by endpoints
 * @class 
 * @property {ArrayIterator} endpointsIterator Iterate array of ordered endpoints 
 * @property {OsmWayEndpoint} currEndpoint Current endpoint 
 * @property {OsmWayEndpointIterator} wayNodesIterator Iterate current way 
 * @property {OsmNode} currWayNode Current way node 
 **/
var BoundaryEndpointsIterator = Class.create(
/** @scope BoundaryEndpointsIterator.prototype */
{
  /** 
   *  @constructs 
   *  @param endpoints Array of OsmWayEndpoint 
   **/
  initialize: function (/**Array */ endpoints) {
    this.endpointsIterator = new ArrayIterator(endpoints);
    this.currEndpoint = undefined;
    this.wayNodesIterator = undefined;
    this.currWayNode = undefined;
  },
  /** 
   *  Returns true if the current position is valid
   *  @returns {Boolean} True if the current position is valid    
   */
  isValid: function () {
    if (this.currEndpoint && this.wayNodesIterator &&
        this.wayNodesIterator.isValid()) {
      return true;
    } else {
      return false;
    }
  },
  /** 
   *  Returns the current way node
   *  @returns {OsmNode} the current way node    
   */
  current: function () {
    if (this.isValid()) {
      this.currWayNode = this.wayNodesIterator.current();
    } else {
      this.currWayNode = undefined;
    }
    return this.currWayNode;    
  },
  /** 
   *  Moves to the first position and return that item
   *  @returns {OsmNode} the first way node    
   */
  first: function () {
    this.currEndpoint = this.endpointsIterator.first();
    this.wayNodesIterator = new OsmWayEndpointIterator(this.currEndpoint);
    this.currWayNode = this.wayNodesIterator.first();
    return this.currWayNode;
  },
  /** 
   *  Moves to the next position and return that item
   *  @returns {OsmNode} the next way node
   */
  next: function () {
    this.currWayNode = undefined;
    if (this.isValid()) {
      this.currWayNode = this.wayNodesIterator.next();
      if (!this.currWayNode) { // no more way nodes for iterator
        this.currEndpoint = this.endpointsIterator.next();
        if (this.currEndpoint) { // another endpoint is available
          this.wayNodesIterator = new OsmWayEndpointIterator(this.currEndpoint);
          this.currWayNode = this.wayNodesIterator.first();
        } else {
          this.wayNodesIterator = undefined;
        }
      }
    }
    return this.currWayNode;    
  }
}); // --BoundaryEndpointsIterator

