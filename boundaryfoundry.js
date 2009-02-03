/**
 * @fileOverview This file is the main application file for the boundary application
 * @author Greg ONeill
 * @version 0.8
 */

// ---from environment
/*global alert document window XMLSerializer */  
// ---from prototype.js
/*global Class $ $$ $A $F $break Ajax Element Event */
// ---from scriptaculous.js
/*global Draggable Droppables */ 
// ---from http://maps.google.com/maps
/*global GBrowserIsCompatible GClientGeocoder GEvent GLatLng GMap2 
          GMapTypeControl GMarker GPolyline GSmallMapControl GUnload */
// ---from utilities.js
/*global XmlDoc AppEvents */
// ---from osmcore.js
/*global OsmBbox OsmBboxDoc OsmWay  eOsmWayEvents  */
// ---from osmapp.js
/*global  BoundaryEndpointsIterator OsmWayEndpoint 
          OsmWayEndpointIterator WayNodeDistance */


/**
 Object that organizes boundary calculations
 * @class 
 * @property {BoundaryAppModel} model Data Model for the Boundary application
 * @property {OsmBbox} overallBounds Bbox that encloses all user-click bboxes 
 * @property {Array} acceptedWays Array of {@link OsmWay} boundary ways
 * @property {Array} bboxes Array of {@link OsmBbox} user-click bboxes 
 * @property {Array} osmWayEndpoints Array of {@link OsmWayEndpoint} 
 * @property {Number} bboxSize The size of user-click bboxes 
 * @property {Array} orderedEndpoints Array of {@link OsmWayEndpoint} 
 * @property {Boolean} completeBoundary True if boundary is complete 
 * @property {OsmWay} index desc 
 **/
var BoundaryCalc = Class.create(
/** @scope BoundaryCalc.prototype */
{
  /** 
   *  @constructs
   *  @param model Data Model for the Boundary application
   */
  initialize: function (/**BoundaryAppModel*/ model) {
    this.model = model;
    this.overallBounds = undefined;
    this.acceptedWays = undefined;
    this.bboxes = $A();
    this.osmWayEndpoints = $A();
    this.bboxSize = 0.0;
    // this field will allow direct assembly of the osm closed way
    this.orderedEndpoints = $A();
    this.completeBoundary = false;
  },

  //---------------
  refresh: function () {
    this.acceptedWays.each(function (osmWay) {
      osmWay.refresh();
    });
  },
  /** 
   *  Trims waynodes from the osmWay of the endpoint up until first enclosing bbox
   *  @param endpoint The endpoint representing the osmWay to be trimmed
   */
  trimNakedEndpoint: function (/**OsmWayEndpoint*/ endpoint) {
  
    var wayNodesBbox = endpoint.osmWay.getWayNodesBbox();
    
    // only use bboxes that intersect with the way nodes bbox
    var bboxes = this.bboxes.findAll(function (currBbox) {
      return wayNodesBbox.intersects(currBbox);
    });

    var bbox = undefined;
    var latLon = undefined;
    var doBreak = false;
    var osmWay = endpoint.osmWay;
    var iterator = new OsmWayEndpointIterator(endpoint);
    
    // iterate from endpoint until enclosing bbox is encountered
    var wayNode = iterator.first();
    while (wayNode) {
      latLon = wayNode.getLatLon();
      for (var i = 0, len = bboxes.length; i < len; ++i) {
        bbox = bboxes[i];
        if (bbox.enclosesLatLon(latLon)) {
          osmWay.trimWayNodesNear(iterator);
          doBreak = true;
          break;
        }
      }
      if (doBreak) {
        break;
      }
      wayNode = iterator.next();
    }
    
    if (doBreak) {
      // adjust the endpoint to reflect way node trimming
      if (endpoint.index !== 0) {
        endpoint.index = endpoint.osmWay.wayNodes.length - 1;
      }
      endpoint.bbox = bbox;
    }
  },
  /** 
   *  Trims waynodes from the osmWay from all endpoints up until first enclosing bbox
   */
  trimNakedEndpoints: function () {
  
    // do not consider points that already have a bbox
    var nakedEndpoints = this.osmWayEndpoints.findAll(function (endpoint) {
      var isNaked = false;
      if (!endpoint.bbox) {
        isNaked = true;
      }
      return isNaked;
    });
    
    var localBoundary = this;
    nakedEndpoints.each(function (endpoint) {
      localBoundary.trimNakedEndpoint(endpoint);
    });
  },
  /** 
   *  Add virtual user-click bboxes wherever 2 naked endpoint are in very close proximity
   */
  addNearEndpointsBboxes: function () {
  // walk thru endpoints, look for near-endpoints and build bbox
  
    // do not consider points that already have a bbox
    var nakedEndpoints = this.osmWayEndpoints.findAll(function (endpoint) {
      var isNaked = false;
      if (!endpoint.bbox) {
        isNaked = true;
      }
      return isNaked;
    });

    var currLatLon = undefined;
    var foundLatLon = undefined;
    var midpointLatLon = undefined;
    var newBbox = undefined;
    
    if (nakedEndpoints) {
      // for each endpoint, search for first near endpoint
      var len = nakedEndpoints.length;
      
      for (var i = 0; i < len; ++i) {
        // check for presence of bboxes assigned in prior pass
        if (nakedEndpoints[i].bbox) {
          continue;
        }
        currLatLon = nakedEndpoints[i].getLatLon();
  
        for (var j = i + 1; j < len; ++j) {
          // check for presence of bboxes assigned in prior pass
          if (nakedEndpoints[j].bbox) {
            continue;
          }
          foundLatLon = nakedEndpoints[j].getLatLon();
          if (currLatLon.isNear(foundLatLon, this.bboxSize)) {
            // near and naked endpoints found so
            // add a new bbox and assign to both endpoints
            newBbox = new OsmBbox();
            midpointLatLon = currLatLon.midpoint(foundLatLon);
            newBbox.fillByMidpointLatLon(midpointLatLon, this.bboxSize);
            nakedEndpoints[i].bbox = newBbox;
            nakedEndpoints[j].bbox = newBbox; 
            this.model.addOsmWayBbox(nakedEndpoints[i].osmWay, newBbox);
            this.model.addOsmWayBbox(nakedEndpoints[j].osmWay, newBbox);
            break; 
          }
        }
      }
    }
  },
  /** 
   *  Regenerates endpoints by looking at accepting osmWays
   */
  buildEndpoints: function () {
    // needs to be called AFTER trimOutliers so bbox matchup will work
    
    // build list of osmway endpoints
    var endpoints = $A();
    this.acceptedWays.each(function (osmWay) {
      endpoints.push(new OsmWayEndpoint(osmWay, 0));
      endpoints.push(new OsmWayEndpoint(osmWay, osmWay.wayNodes.length - 1));
    }); 
    
    // attempt to link endpoint to bbox
    var bboxes = this.bboxes;
    endpoints.each(function (endpoint) {
      var latLon = endpoint.getLatLon();
      var foundBbox = bboxes.find(function (bbox) {
        if (bbox.enclosesLatLon(latLon)) {
          return true;
        } else { 
          return false;
        }
      });
      if (foundBbox) {
        endpoint.bbox = foundBbox;
      }
    });
    this.osmWayEndpoints = endpoints;
  },
  /** 
   *  Find way pairs that terminate in the same bbox and trim them to nearest points
   */
  trimBboxes: function () {

    var currWay = undefined;
    var matchWay = undefined;
    var currWayBbox = undefined;
    var matchWayBbox = undefined;
    var currWayBboxes = undefined;
    var matchWayBboxes = undefined;

    // search for bbox matches among the osmWays and
    // pass them in for final triming
    // !!! Looking back at this narrowly, it seems like this should
    // operate upon the array of endpoints (with bboxes applied)
    
    for (var i = 0, len = this.acceptedWays.length; i < len; ++i) {
      currWay = this.acceptedWays[i];
      
      currWayBboxes = this.model.getOsmWayBboxesById(currWay.id);
      for (var ib = 0, ibLen = currWayBboxes.length; ib < ibLen; ++ib) {
        currWayBbox = currWayBboxes[ib];

        for (var j = i + 1, jLen = this.acceptedWays.length; j < jLen; ++j) {
          matchWay = this.acceptedWays[j];
          
          matchWayBboxes = this.model.getOsmWayBboxesById(matchWay.id);
          for (var jb = 0, jbLen = matchWayBboxes.length; jb < jbLen; ++jb) {
            matchWayBbox = matchWayBboxes[jb];

            if (currWayBbox.equals(matchWayBbox)) {
              this.trimBboxWays(currWay, matchWay, currWayBbox);
            }
          }
        }
      }
    }
  },
  /** 
   *  Given two ways that terminate in the same bbox, trim them to nearest points
   *  @param osmWay1 The endpoint representing the osmWay to be trimmed
   *  @param osmWay2 The endpoint representing the osmWay to be trimmed
   *  @param bbox The bbox shared by the 2 osmWays
   */
  trimBboxWays: function (/**OsmWay*/ osmWay1, /**OsmWay*/ osmWay2, /**OsmBbox*/ bbox) {

    var endpoint1 = new OsmWayEndpoint(osmWay1, 0);
    var endpoint2 = new OsmWayEndpoint(osmWay2, 0);
    
    endpoint1.updateWithBbox(bbox);
    endpoint2.updateWithBbox(bbox);
    
    if (endpoint1.bbox && endpoint2.bbox) {
    
      var iterator1 = new OsmWayEndpointIterator(endpoint1);
      var iterator2 = new OsmWayEndpointIterator(endpoint2);
      
      var wayNodesDistances = $A();
      var wayNodeDistance = undefined;
      
      // calculate distance for every combination
      // of latLons (within the bbox) for the the osmWays
      var wayNode1 = iterator1.first();
      var wayNode2 = undefined;
      while (wayNode1 && bbox.enclosesLatLon(wayNode1.getLatLon())) {
  
        wayNode2 = iterator2.first();
        while (wayNode2 && bbox.enclosesLatLon(wayNode2.getLatLon())) {
          wayNodeDistance = new WayNodeDistance();
          wayNodeDistance.fillByEndpointIterators(iterator1, iterator2);
          wayNodesDistances.push(wayNodeDistance);
          
          wayNode2 = iterator2.next();
        }
        wayNode1 = iterator1.next();
      }
      
      var sortedWayNodeDistances = wayNodesDistances.sortBy(function (wayNodeDistance) {
        return wayNodeDistance.distance;
      });
      
      wayNodeDistance = sortedWayNodeDistances[0];
      // !!! should (someday) make adjustment if the closest endpoint s
      // are part of segments that cross
      //     if (wayNodeDistance.segmentsCrossed()) {
      //       wayNodeDistance = sortedWayNodeDistances[1];
      //     };
      
      // set currIndex state of iterators corresponding to nearest waynodes
      iterator1.currIndex = wayNodeDistance.currIndex1;
      iterator2.currIndex = wayNodeDistance.currIndex2;
      wayNodeDistance.iterator1.osmWayEndpoint.osmWay.trimWayNodesNear(iterator1);
      wayNodeDistance.iterator2.osmWayEndpoint.osmWay.trimWayNodesNear(iterator2);
    }
  },
  /** 
   *  Finds the index of the {@link OsmWayEndpoint} that matches the given bbox
   *  @param bbox The {@link OsmBbox} to find the matching endpoint
   *  @param skipIndex The endpoint index to be skipped in the search
   *  @returns {Number} The found index having bbox with matching key (else -1)  
   */
  findEndpointIndexByBbox: function (/**OsmBbox*/ bbox, /**Number*/ skipIndex) {

    var key = bbox.key();

    var foundIndex = -1;
    this.osmWayEndpoints.each(function (endpoint, index) {
      if (index === skipIndex) {
        return;
      }
      if (endpoint.bbox.key() === key) {
        foundIndex = index;
        throw $break;
      }
    });
    return foundIndex;
  },
  /** 
   *  Finds the index of the {@link OsmWayEndpoint} that matches the given osmWay
   *  @param osmWay The {@link OsmWay} to find the matching endpoint
   *  @param skipIndex The endpoint index to be skipped in the search
   *  @returns {Number} The found index having bbox with matching key (else -1)  
   */
  findEndpointIndexByWay: function (/**OsmWay*/ osmWay, /**Number*/ skipIndex) {

    var foundIndex = -1;
    var id = osmWay.id;
    this.osmWayEndpoints.each(function (endpoint, index) {
      if (index === skipIndex) {
        return;
      }
      if (endpoint.osmWay.id === id) {
        foundIndex = index;
        throw $break;
      }
    });
    return foundIndex;
  },
  /** 
   *  Builds, this.orderedEndpoints, an array of {@link OsmWayEndpoint} in boundary order
   */
  buildBoundaryEndpoints: function () {
  
    var currEndpoint = undefined;
    var foundIndex = 0;
    var dofindWay = true;
    
    // alternate between an osmWay and bbox search of endpoints
    // note: assume 2 endpoints per way and 2 ways per bbox
    // (given endpoint.osmWay, find matching endpoint, get bbox, 
    // find matching endpoint, do it again)
    do {
      currEndpoint = this.osmWayEndpoints[foundIndex];
      // record found endpoint
      this.orderedEndpoints.push(currEndpoint);
      if (dofindWay) {
        foundIndex = this.findEndpointIndexByWay(currEndpoint.osmWay, foundIndex);
        dofindWay = false;
      } else {
        foundIndex = this.findEndpointIndexByBbox(currEndpoint.bbox, foundIndex);
        dofindWay = true;
      }
      // continue while we have not returned to 1st endpoint and
      // while matching succeeds
    } while (foundIndex !== 0 && foundIndex !== -1);
    
    if (foundIndex === -1) { // terminatated with matching failure
      this.completeBoundary = false;
    } else { // terminated by closing the loop
      this.completeBoundary = true;
    }
  },
  /** 
   *  If either end of an osmWay extends beyond the union of user-click bboxes
   *  trim it back to the first enclosing bbox   
   *  @param osmWay The {@link OsmWay} to be trimmed
   *  @param bigBounds The union of user-click bboxes
   *  @param bboxes The array of {@link OsmBbox} to be checked
   */
  trimOutliers: function (/**OsmWay*/ osmWay, /**OsmBbox*/ bigBounds, /**Array*/ bboxes) {
    // trims out wayNodes starting from outlier endpoint
    // 'into' the first bbox bounds

    var bbox = undefined;
    var latLon = undefined;
    
    var firstEndpoint = new OsmWayEndpoint(osmWay, 0);
    var firstIterator = new OsmWayEndpointIterator(firstEndpoint);
    
    var wayNode = firstIterator.first();
    if (wayNode && !bigBounds.enclosesLatLon(wayNode.getLatLon())) {
      latLon = wayNode.getLatLon();
      for (var i = 0, len = bboxes.length; i < len; ++i) {
        bbox = bboxes[i];
        if (bbox.enclosesLatLon(latLon)) {
          osmWay.trimWayNodesNear(firstIterator);
          break;
        }
      }
      wayNode = firstIterator.next();
    }

    var lastEndpoint = new OsmWayEndpoint(osmWay, osmWay.wayNodes.length - 1);
    var lastIterator = new OsmWayEndpointIterator(lastEndpoint);
    
    wayNode = lastIterator.first();
    if (wayNode && !bigBounds.enclosesLatLon(wayNode.getLatLon())) {
      latLon = wayNode.getLatLon();
      for (i = 0, len = bboxes.length; i < len; ++i) {
        bbox = bboxes[i];
        if (bbox.enclosesLatLon(latLon)) {
          osmWay.trimWayNodesNear(lastIterator);
          break;
        }
      }
      wayNode = lastIterator.next();
    }
  },
  /** 
   *  Main routine for performing overall boundary calculations
   */
  calculate: function () {
    // calculate bbox that encloses all bboxes
    this.acceptedWays = this.model.getAcceptedWays();
    if (this.acceptedWays.length > 0) {
      this.overallBounds = this.model.bboxUnion();
      this.bboxes = this.model.bboxes;
  
      // find and 'clothe' naked endpoints with a bbox, if they are close enough
      this.buildEndpoints();
      this.addNearEndpointsBboxes();
      
      // trim ways having endpoints outside the overall bbox 
      var localBounds = this.overallBounds;
      var that = this;
      this.acceptedWays.each(function (osmWay) {
        var osmWayBboxes = that.model.getOsmWayBboxes(osmWay);
        that.trimOutliers(
            osmWay, that.overallBounds, osmWayBboxes);
      });
      // !!! inefficient - endpoints should update as 
      // waynodes are trimmed, but this will do for now
      this.buildEndpoints();

      // trim naked waynodes back to the nearest bbox
      this.trimNakedEndpoints();
      
      // trim extra points within bboxes
      this.trimBboxes();
  
      // !!! inefficient - endpoints should update as 
      // waynodes are trimmed, but this will do for now
      this.buildEndpoints();
      
      // Finally - build the boundary
      this.buildBoundaryEndpoints();
    }
  },
  /** 
   *  Generates xml corresponding to the calculated boundary
   *  !!! Note: not yet working   
   *  @param xmlDoc The {@link OsmWay} to be trimmed
   */
  generateXml: function (/**XmlDoc*/ xmlDoc) {
  
    var wayElm = new Element('way');
    wayElm.writeAttribute('visible', 'true');
    
    var ndRefElm = undefined;
    xmlDoc.appendChild(wayElm);
    // append nd elements to way
    var iterator = new BoundaryEndpointsIterator(this.orderedEndpoints);
    var currWayNode = iterator.first();
    while (currWayNode) {
      ndRefElm = new Element('nd');
      ndRefElm.writeAttribute('ref', currWayNode.id);

      wayElm.appendChild(ndRefElm);
      wayElm.appendChild(document.createTextNode("\n"));
      currWayNode = iterator.next();
    }
    // append tag elements to way
    var xmlString = new XMLSerializer().serializeToString(xmlDoc);

    var myWindow = window.open('', '', 'width=400,height=400');
    myWindow.document = xmlDoc;
    myWindow.focus();
    
  }
}); // --Boundary

/**
 * This object acts as the enum for state of {@link BoundaryAppOsmWay}
 * @field
 */  
var eWayState = { // order is important to myWayStateData
  Unavailable: 0,
  Available: 1,
  Accepted: 2,
  Rejected: 3
};

/**
 * This object acts as the enum for the events of {@link BoundaryAppOsmWay}
 * @field
 */  
var eWayEvents = {
  onStateChanged: 'onStateChanged',
  onRemove: 'onRemove',
  onRefresh: 'onRefresh'
};


/**
 Represents OsmWay endpoint (of waynodes) including bbox (at click pt)
 * @class 
 * @property {Number} eWayState value for this set of data 
 * @property {Number} polylineColor Color of polyline for way having this.wayState value
 * @property {Number} draggingColor Color of dragged polyline for way having this.wayState value
 **/
var BoundaryAppWayStateData = Class.create(
/** @scope BoundaryAppWayStateData.prototype */
{
  /** 
   *  @constructs
   *  @param state eWayState value for this set of data
   *  @param color Color of polyline for way having this.wayState value
   *  @param dragColor Color of dragged polyline for way having this.wayState value
   */
  initialize: function (/**Number*/ state, /**Number*/ color, /**Number*/ dragColor) {
    this.wayState = state;
    this.polylineColor = color;
    this.draggingColor = dragColor;
  }
});

/**
 Represents BoundaryApp specific subclass of OsmWay that captures the state of the way
 * @class 
 * @augments  OsmWay
 * @property {Boolean} isDragging True if way is being dragged to new state
 * @property {Number} wayState eWayState value for this way
 **/
var BoundaryAppOsmWay = Class.create(OsmWay,
/** @scope BoundaryAppOsmWay.prototype */
{
  /** 
   *  @constructs
   *  @param $super Reference to OsmWay class constructor
   */
  initialize: function (/**Function*/ $super) {
    $super();

    this.isDragging = false;
    this.wayState = eWayState.Unavailable;
    
    // !!! Oink - this should not be in every object - move it - static, etc
    this.wayStateData = [
      new BoundaryAppWayStateData(eWayState.Unavailable, null, null),
      new BoundaryAppWayStateData(eWayState.Available, "#032BB3", "#017588"),
      new BoundaryAppWayStateData(eWayState.Accepted, "#00B365", "#017588"),
      new BoundaryAppWayStateData(eWayState.Rejected, null, "#017588")
    ];
  },
  /** 
   *  @returns {Boolean} True If this way is available
   */
  isAvailable: function () {
    return (this.wayState === eWayState.Available);
  },
  /** 
   *  @returns {Boolean} True If this way is unavailable
   */
  isUnavailable: function () {
    return (this.wayState === eWayState.Unavailable);
  },
  /** 
   *  @returns {Boolean} True If this way is rejected
   */
  isRejected: function () {
    return (this.wayState === eWayState.Rejected);
  },
  /** 
   *  @returns {Boolean} True If this way is accepted
   */
  isAccepted: function () {
    return (this.wayState === eWayState.Accepted);
  },
  /** 
   *  @returns {BoundaryAppWayStateData} Data corresponding to state of this way
   */
  getStateData: function () {
    var wayStateData = this.wayStateData[this.wayState];
    return wayStateData;
  },
  /** 
   *  Changes the state of this way
   *  @param wayState The new state for this way   
   */
  changeState: function (/**Number*/ wayState) {
    if (this.wayState !== wayState) {
      this.wayState = wayState;
      var wayStateData = this.getStateData();
      var that = this;
      this.events.fire(eWayEvents.onStateChanged, 
          {stateData: wayStateData, osmWay: that});
    }
  },
  /** 
   *  Forces a refresh event for all ways
   */
  refresh: function () {
    var that = this;
    var wayStateData = this.getStateData();
    this.events.fire(eWayEvents.onRefresh, 
          {stateData: wayStateData, osmWay: that});
  },
  /** 
   *  Forces a remove event on this way
   */
  remove: function () {
    var that = this;
    this.events.fire(eWayEvents.onRemove, {osmWay: that});
  },
  /** 
   *  Changes isDragging state and fires onStateChanged event
   */
  startDrag: function () {
    this.isDragging = true;
    var wayStateData = this.getStateData();
    var that = this;
    // not real state change but forces redraw while considering isDragging
    this.events.fire(eWayEvents.onStateChanged, 
        {stateData: wayStateData, osmWay: that});
  },
  /** 
   *  Changes isDragging state and fires onStateChanged event
   */
  stopDrag: function () {
    this.isDragging = false;
    var wayStateData = this.getStateData();
    var that = this;
    // not real state change but forces redraw while considering isDragging
    this.events.fire(eWayEvents.onStateChanged, 
        {stateData: wayStateData, osmWay: that});
  }
}); //--BoundaryAppOsmWay

/**
 Provides a GMap based map-polyline drawing capability
 * @class 
 * @property {Object} map The map object created by google
 * @property {Object} geocoder Provides geocoding courtesy of google
 * @property {String} mapId Id of html map element
 * @property {Array} polylines Object of google polyline objects indexed by osmway id
 * @property {Function} onMapClick Function to respond to a click on the map
 **/
var OsmGMap = Class.create(OsmWay,
/** @scope OsmGMap.prototype */
{
  /** 
   *  @constructs
   *  @param mapId Id of the html map element
   *  @param onMapClick Function to execute when the map is clicked
   */
  initialize: function (mapId, onMapClick) {
    this.map = null;
    this.geocoder = null;
    this.mapId = mapId;
    this.polylines = {};
    this.onMapClick = onMapClick;
  },
  /** 
   *  Returns true if the map support can be loaded   
   *  @returns {Boolean} True if the map support can be loaded   
   */
  canLoad: function () {
    return (GBrowserIsCompatible());
  },
  /** 
   *  Load mapping object to prepare for application support   
   */
  load: function () {
    this.map = new GMap2(document.getElementById(this.mapId));
    this.map.addControl(new GSmallMapControl());
    this.map.addControl(new GMapTypeControl());
    this.geocoder = new GClientGeocoder();
    
    var localOsmGMap = this;
    
    var listener = GEvent.addListener(this.map, "click", 
      function (overlay, point) {
        localOsmGMap.onMapClick(point);
      }
    );
  },
  /** 
   *  Display a callout box on the map indicating the xyPoint 
   *  @param xyPoint Point to be displayed by callout
   */
  displayLatLonCallout: function (/**Object*/ xyPoint) {
    var pointText = xyPoint.x.toFixed(4) + ", " + xyPoint.y.toFixed(4);
    
    var pointDesc = "Lon., Lat., zoom: " + pointText + ", " + this.map.getZoom();
    this.map.openInfoWindow(xyPoint, pointDesc);
  },
  /** 
   *  Convert BoundaryApp latLons to google map equivalent 
   *  @param latLons Array of {@link LatLon} values
   *  @returns {Array} google map compatible polyline points   
   */
  getGlatlngs: function (latLons) {
    // google map example
    //var polyPoints = [
    //  new GLatLng(37.4419, -122.1419),
    //  new GLatLng(37.4519, -122.1519)
    //]  
    var glatlngs = latLons.collect(function (latLon) {
      return new GLatLng(latLon.lat(), latLon.lon());
    });
    return glatlngs;
  },
  /** 
   *  Generate new google polyline for osmWay and display it on map using polyColor
   *  @param osmWay Array of {@link LatLon} values
   *  @param polyColor Color used to display polyline
   */
  drawNewOsmWay: function (/**OsmWay*/ osmWay, /**Number*/ polyColor) {
    var latLons = osmWay.wayNodes;
    var glatlngs = this.getGlatlngs(latLons);
    
    var polyline = new GPolyline(glatlngs, polyColor, 7);
    this.map.addOverlay(polyline);
    
    var osmWayId = osmWay.id.toString();
    this.polylines[osmWayId] = polyline;
  },
  /** 
   *  Remove existing polyline based on osmWayId
   *  @param osmWayId Id of OsmWay to be removed
   */
  clearOsmWay: function (/**Number*/ osmWayId) {

    var polyline = this.polylines[osmWayId.toString()];
    if (!!polyline) {
      this.map.removeOverlay(polyline);
      delete this.polylines[osmWayId.toString()];
    }
  },
  /** 
   *  EventHandler to respond to onRemove event for osmWay specified in eventData
   *  @param eventData Event related data including osmWay
   */
  onRemove: function (/**Object*/ eventData) {

    var osmWayId = eventData.osmWay.id.toString();
    this.clearOsmWay(osmWayId); 
  },
  /** 
   *  Get PolyColor from osmWay based on osmWay state and given stateData
   *  @param stateData Get polyline color from osmWay state applied to state data
   */
  getPolyColor: function (osmWay, /**BoundaryAppWayStateData*/ stateData) {
    var polyColor = undefined; 
    if (osmWay.isDragging) {
      polyColor = stateData.draggingColor;
    } else {
      polyColor = stateData.polylineColor;
    }
    return polyColor;
  },
  /** 
   *  EventHandler to respond to onStateChange event for osmWay specified in eventData
   *  @param eventData Event related data including osmWay
   */
  onStateChange: function (/**Object*/ eventData) {

    var osmWay = eventData.osmWay;
    var polyColor = this.getPolyColor(osmWay, eventData.stateData);
    var osmWayId = osmWay.id.toString();
    
    var polyline = this.polylines[osmWayId];
    
    if (osmWay.wayState === eWayState.Rejected) {
      this.clearOsmWay(osmWayId);
      
    } else if (!polyline) { 
      this.drawNewOsmWay(osmWay, polyColor);
      
    } else if (polyline) {
      polyline.setStrokeStyle({color: polyColor, weight: 7});
    }
  },
  /** 
   *  EventHandler to respond to onRefresh event for osmWay specified in eventData
   *  @param eventData Event related data including osmWay
   */
  onRefreshOsmWay: function (/**Object*/ eventData) {

    var osmWayId = eventData.osmWay.id.toString();
    this.clearOsmWay(osmWayId);

    var osmWay = eventData.osmWay;    
    var polyColor = this.getPolyColor(osmWay, eventData.stateData);
    this.drawNewOsmWay(osmWay, polyColor);
  },
  /** 
   *  EventHandler to respond to onWayNodesChanged event for osmWay specified in eventData
   *  @param eventData Event related data including osmWay
   */
  onWayNodesChanged: function (/**Object*/ eventData) {

    var wayStateData = eventData.osmWay.getStateData();
    eventData.stateData = wayStateData;
    this.onRefreshOsmWay(eventData);
  },
  /** 
   *  Displays map centered on the given address
   *  @param address Address to be displayed on map
   */
  showAddress: function (/**String*/ address) {
    // given address, mark and center map at that location
    var localMap = this.map;
    this.geocoder.getLatLng(
      address,
      function (point) {
        if (!point) {
          alert(address + " not found");
        } else {
          var marker = new GMarker(point);
          localMap.setCenter(point, 13);
          localMap.addOverlay(marker);
          marker.openInfoWindowHtml(address);
        }
      }
    );
  }
}); // OsmGMap


/**
 Provides the ability to link to openstreetmap via php gateway code on server
 * @class 
 * @property {Number} bboxSize Size of a user-click bbox
 **/
var OsmLink = Class.create(
/** @scope OsmLink.prototype */
{
  /** @constructs */
  initialize: function () {
    this.bboxSize = 0.002; // size of square map click bbox
  },
  /** 
   *  Generates query text to be forwarded to openstreemap via php server code
   *  @param osmBbox User-click bbox to select intersecting ways from openstreetmap   
   */
  getBboxQuery: function (/**OsmBbox*/ osmBbox) {
    var query = 'bbox=';
    query += osmBbox.minlon.toFixed(4) + "," + 
              osmBbox.minlat.toFixed(4) + "," + 
              osmBbox.maxlon.toFixed(4) + "," + 
              osmBbox.maxlat.toFixed(4);
    return query;
  },
  /** 
   *  Retrieve OSM XML and convert to XmlDoc and return it
   *  @param xyPoint Lat. and lon provided in y and x of this object 
   *  @returns {XmlDoc}     
   */
  getClickPointData: function (/**Object*/ xyPoint) {

    // !!! asynchronous:false needs to be removed - make code mods for async

    // notes: for osm call to get bbox data
    // var url = 'http://api.openstreetmap.org/api/0.5/map?bbox=' + 
    // $('bbox1').value + ',' + $('bbox2').value;	
    
    // !!!use this osmBbox when SOP solution is in operation
    var osmBbox = new OsmBbox();
    osmBbox.fillByXYPoint(xyPoint, this.bboxSize);
    
    var xmlDoc = undefined;
    var url = 'http://www.pursuitofmappiness.com/boundaryfoundry/osmgateway.php?' + this.getBboxQuery(osmBbox);
    if (url) {
      var ajaxRequest = new Ajax.Request(url, {
        method: 'get',
        asynchronous: false,
        onSuccess: function (transport) {
        	xmlDoc = new XmlDoc(transport.responseText);
        	alert("Success! \n\n" + transport.responseText.substring(0, 50));
        },
        onFailure: function () { 
          alert('onFailure...');
        }
      });
    }
    return xmlDoc;
  }
}); //--OsmLink

/**
 * This object acts as the enum event generated by the view
 * @field
 */  
var eViewerEvents = {
  onDropAvailable: 'onDropAvailable',
  onDropAccepted: 'onDropAccepted',
  onDropRejected: 'onDropRejected',
  onDragStart: 'onDragStart',
  onDragEnd: 'onDragEnd'
};

/**
 Provides the ability to link to openstreetmap via php gateway code on server
 * @class 
 * @property {String} availableDstId Id of html div for available ways
 * @property {String} acceptedDstId Id of html div for accepted ways
 * @property {String} rejectedDstId Id of html div for rejected ways
 * @property {String} availableListId Id of html ul for available ways
 * @property {String} acceptedListId Id of html ul for accepted ways
 * @property {String} rejectedListId Id of html ul for rejected ways
 * @property {String} deselectedClass Name of class applied to deselected items
 * @property {String} selectedClass Name of class applied to selected item
 * @property {String} osmBrowseWayUrl Url that allows browsing of way info in a separate window
 * @property {Object} events AppEvents object having events for this object
 **/
var BoundaryAppViewer = Class.create(
/** @scope BoundaryAppViewer.prototype */
{
  /** @constructs */
  initialize: function () {
    this.availableDstId = 'availableDiv';
    this.acceptedDstId = 'acceptedDiv';
    this.rejectedDstId = 'rejectedDiv';

    this.availableListId = 'availableList';
    this.acceptedListId = 'acceptedList';
    this.rejectedListId = 'rejectedList';
    
    this.deselectedClass = 'deselected';
    this.selectedClass = 'selected';
    this.osmBrowseWayUrl = 'http://www.openstreetmap.org';
    this.events = undefined;
  },
  /** 
   *  Setup events for this object
   */
  setEvents: function (events) {
    this.events = events;
  },
  /** 
   *  Setup available, accepted, and rejected drop zones
   */
  load: function () {
    this.setupAvailableDrop();
    this.setupAcceptedDrop();
    this.setupRejectedDrop();
  },
  /** 
   *  Return a html li element with the given id and name
   *  @param Name Text to the display in the li element 
   *  @param id Id to be assigned to the li element 
   *  @returns {Object} Return html li element  
   */
  newOsmLi: function (/**Number*/ id, /**String*/ name) {
    // use existing osm way as input for new li
    var li = new Element('li');
    li.update(name);
    li.writeAttribute('id', id);
    li.writeAttribute('class', 'deselected');
    return li;
  },
  /** 
   *  Return a html li element with the id and name of the given li element
   *  @param oldOsmLi Text to the display in the li element 
   *  @returns {Object} Return html li element  
   */
  cloneOsmLi: function (/**Object*/ oldOsmLi) {
    // create copy of oldOsm <li> and return the copy
    var liText = oldOsmLi.childNodes[0].nodeValue;
    var li = this.newOsmLi(oldOsmLi.id, liText);
    return li;
  },
  /** 
   *  Remove all html li elements under this.availableListId
   */
  clearAvailableWays: function () {
    // clear out available li items 
    var liSelector = '#' + this.availableListId + ' li';
 
    // clean up draggables and polylines for li items before we remove them
    $$(liSelector).each(function (draggableItem) {
      if (draggableItem.dragHandle) {
        draggableItem.dragHandle.destroy();
      }
      draggableItem.remove();
    });
  },
  /** 
   *  Remove all html li elements under this.rejectedListId
   */
  clearRejectedWays: function () {

    // clear out rejected li items 
    var liSelector = '#' + this.rejectedListId + ' li';
    $$(liSelector).each(function (rejectedItem) {
      rejectedItem.remove();
    });
  },
  /** 
   *  Remove all html li elements under this.acceptedListId
   */
  clearAcceptedWays: function () {

    // clear out accepted li items 
    var liSelector = '#' + this.acceptedListId + ' li';
    $$(liSelector).each(function (acceptedItem) {
      acceptedItem.remove();
    });
  },
  /** 
   *  Setup the html element, this.availableDstId, as a drop zone
   */
  setupAvailableDrop: function () {

    var ulDropDstId = this.availableDstId;
    var that = this;
    var makeElementDraggableBind = 
          this.makeElementDraggable.bindAsEventListener(that);
    
    Droppables.add(ulDropDstId, { 
      containment: [this.acceptedListId, this.rejectedListId], 
      onDrop: function (dragged, droppedOn, event) {

        var element = $(dragged);
        var newElement = that.cloneOsmLi(element);
        element.dragHandle.destroy();
        element.remove();
        
        if (that.events) {
          that.events.fire(eViewerEvents.onDropAvailable, {id: newElement.id});
        }
        $$('#' + ulDropDstId + ' ul').first().appendChild(newElement);

        makeElementDraggableBind(newElement);
      }
    });
  },
  /** 
   *  Setup the html element, this.acceptedDstId, as a drop zone
   */
  setupAcceptedDrop: function () {

    var ulDropDstId = this.acceptedDstId;
    var that = this;
    var makeElementDraggableBind = 
          this.makeElementDraggable.bindAsEventListener(that);
    
    Droppables.add(ulDropDstId, { 
      containment: this.availableListId, 
      onDrop: function (dragged, droppedOn, event) {

        var element = $(dragged);
        var newElement = that.cloneOsmLi(element);
        element.dragHandle.destroy();
        element.remove();
        
        if (that.events) {
          that.events.fire(eViewerEvents.onDropAccepted, {id: newElement.id});
        }
        $$('#' + ulDropDstId + ' ul').first().appendChild(newElement);
        
        makeElementDraggableBind(newElement);
      }
    });
  },
  /** 
   *  Setup the html element, this.rejectedDstId, as a drop zone
   */
  setupRejectedDrop: function () {

    var ulDropDstId = this.rejectedDstId;
    var that = this;
    var makeElementDraggableBind = 
          this.makeElementDraggable.bindAsEventListener(that);
    
    Droppables.add(ulDropDstId, { 
      containment: [this.availableListId, this.acceptedListId],
      onDrop: function (dragged, droppedOn, event) {

        var element = $(dragged);
        var newElement = that.cloneOsmLi(element);
        element.dragHandle.destroy();
        element.remove();
        
        if (that.events) {
          that.events.fire(eViewerEvents.onDropRejected, {id: newElement.id});
        }
        $$('#' + ulDropDstId + ' ul').first().appendChild(newElement);
        
        makeElementDraggableBind(newElement);
      }
    });
  },
  /** 
   *  Make the given html element, draggableItem, draggable
   *  @param draggableItem Html element to be made draggable
   */
  makeElementDraggable: function (/**Object*/ draggableItem) {
    var that = this;
    draggableItem.dragHandle = new Draggable(draggableItem, {
      revert: true,
      onStart: function (draggable, event) {
        if (that.events) {
          that.events.fire(eViewerEvents.onDragStart, {id: draggable.element.id});
        }
      },
      onEnd: function (draggable, event) {
        if (that.events) {
          that.events.fire(eViewerEvents.onDragStop, {id: draggable.element.id});
        }
      }
    });
  },
  /** 
   *  Make all html li elements under this.availableListId,  draggable
   */
  makeAvailableListDraggable: function () {
    var makeElementDraggableBind = this.makeElementDraggable.bind(this);
    var liSelector = '#' + this.availableListId + ' li';
    $$(liSelector).each(function (draggableItem) {
      makeElementDraggableBind(draggableItem);
    });
  },
  /** 
   *  Display the Array of {@link OsmWay} as html li elements under this.availableListId
   */
  displayAvailableList: function (/**Array*/ osmWays) {

    // build up array of new li elements based on osmWays
    var newOsmLiBind = this.newOsmLi.bind(this);
    var liElements = osmWays.collect(function (osmWay) {      
      var li = newOsmLiBind(osmWay.id, osmWay.name);
      return li;
    });

    var ulElement = $(this.availableListId);
    liElements.each(function (liElement) {
      ulElement.appendChild(liElement);
    });
    this.makeAvailableListDraggable();
  },
  /** 
   *  Set class of all html li elements to this.deselectedClass
   */
  clearSelection: function () {
    var that = this;
    var liSelector = '#' + this.availableListId + ' li';
    $$(liSelector).each(function (listItem) {
      listItem.className = that.deselectedClass;
    });

    liSelector = '#' + this.acceptedListId + ' li';
    $$(liSelector).each(function (listItem) {
      listItem.className = that.deselectedClass;
    });

    liSelector = '#' + this.rejectedListId + ' li';
    $$(liSelector).each(function (listItem) {
      listItem.className = that.deselectedClass;
    });
  },
  /** 
   *  Set class of given html li element to this.selectedClass
   */
  setSelection: function (/**Object*/ element) {
    var el = $(element);
    el.removeClassName(this.deselectedClass);
    el.addClassName(this.selectedClass);
  },
  /** 
   *  Select given element and update link to openstreetmap browse link
   */
  selectLi: function (/**Object*/ element) {
    if (element.tagName === 'LI') {
      this.clearSelection();
      this.setSelection(element);
      $$('#osmBrowseWay')[0].href = this.osmBrowseWayUrl + 
          '/browse/way/' + element.id;
    }
  }
}); //--BoundaryAppViewer

/**
 Manages data to be presented by the application
 * @class 
 * @property {Array} osmWays Array of {@link OsmWay}
 * @property {Object} osmWaysById OsmWay data indexed by osmWay.id
 * @property {Object} osmWayBboxesById OsmBbox arrays corresponding to osmWay.id
 * @property {Array} bboxes Array of {@link OsmBbox}
 * @property {Object} bboxesByKey OsmBbox data indexed by OsmBbox.key()
 * @property {Array} osmWayBboxPairs Array of objects that pair osmWay and bbox
 **/
var BoundaryAppModel = Class.create(
/** @scope BoundaryAppModel.prototype */
{
  /** @constructs */
  initialize: function () {
    this.osmWays = $A();
    this.osmWaysById = {};
    this.osmWayBboxesById = {};

    this.bboxes = $A();
    this.bboxesByKey = {};

    this.osmWayBboxPairs = $A();
  },
  /** 
   *  Returns True if the given osmWayId exists
   *  @returns True if the given osmWayId exists
   */
  osmWayExists: function (/**Number*/ osmWayId) {
    return !!this.osmWaysById[osmWayId.toString()]; // force out a boolean
  },
  /** 
   *  Returns True if the given bboxKey exists
   *  @returns {Boolean} True if the given bboxKey exists
   */
  bboxExists: function (bboxKey) {
    return !!this.bboxesByKey[bboxKey.toString()]; // force out a boolean
  },
  /** 
   *  Add osmWay and corresponding bbox (user-click bbox)
   *  @param osmWay OsmWay to be added
   *  @param bbox OsmBbox corresponding to user-click on map
   */
  addOsmWayBbox: function (/**OsmWay*/ osmWay, /**OsmBbox*/ bbox) {
    
    var osmWayId = osmWay.id.toString();
    var bboxKey = bbox.key().toString();
    
    // add osmWay if it does not already exist
    if (!this.osmWayExists(osmWayId)) {
      this.osmWaysById[osmWayId] = osmWay;
      this.osmWayBboxesById[osmWayId] = $A();
      this.osmWays.push(osmWay);
    } else {
      osmWay = this.osmWaysById[osmWayId];
    }
    
    // add bbox if it does not already exist
    if (!this.bboxExists(bboxKey)) {
      this.bboxesByKey[bboxKey] = bbox;
      this.bboxes.push(bbox);
    } else {
      bbox = this.bboxesByKey[bboxKey];
    }
    
    // record bboxes for this way
    this.osmWayBboxesById[osmWayId].push(bbox);
    
    // record the pair using new or found info
    var osmWayBbox = {osmWay: osmWay, bbox: bbox};
    this.osmWayBboxPairs.push(osmWayBbox);
  },
  /** 
   *  Returns OsmBboxes associated with this osmWayId
   *  @returns {Array} Returns OsmBboxes associated with this osmWayId
   */
  getOsmWayBboxesById: function (osmWayId) {
    return this.osmWayBboxesById[osmWayId.toString()];
  },
  /** 
   *  Returns OsmWay associated with this osmWayId
   *  @returns {OsmWay} Returns OsmWay associated with this osmWayId
   */
  getOsmWayById: function (osmWayId) {
    return this.osmWaysById[osmWayId.toString()];
  },
  /** 
   *  Returns array of {@link OsmBbox} associated with given osmWay
   *  @param osmWay OsmWay to be used to find corresponding bboxes
   *  @returns {Array} Returns array of {@link OsmBbox} associated with given osmWay
   */
  getOsmWayBboxes: function (/**OsmWay*/ osmWay) {
    var localOsmWay = osmWay;
    var bboxes = $A();
    this.osmWayBboxPairs.each(function (osmWayBboxItem) {
      if (osmWayBboxItem.osmWay === localOsmWay) {
        bboxes.push(osmWayBboxItem.bbox);
      }
    });
    return bboxes;
  },
  /** 
   *  Returns array of {@link OsmWay} that are accepted
   *  @returns {Array} Returns array of {@link OsmWay} that are accepted
   */
  getAcceptedWays: function () {
    var acceptedWays = this.osmWays.findAll(function (osmWay) {
      return osmWay.isAccepted();
    });
    return acceptedWays;
  },
  /** 
   *  Returns array of {@link OsmWay} that are available
   *  @returns {Array} Returns array of {@link OsmWay} that are available
   */
  getAvailableWays: function () {
    var availableWays = this.osmWays.findAll(function (osmWay) {
      return osmWay.isAvailable();
    });
    return availableWays;
  },
  /** 
   *  Returns array of {@link OsmWay} that are unavailable
   *  @returns {Array} Returns array of {@link OsmWay} that are unavailable
   */
  getUnavailableWays: function () {
    var unavailableWays = this.osmWays.findAll(function (osmWay) {
      return osmWay.isUnavailable();
    });
    return unavailableWays;
  },
  /** 
   *  Re-Initialize the model
   */
  clearAll: function () {
    this.osmWays = $A();
    this.osmWaysById = {};
    this.osmWayBboxesById = {};

    this.bboxes = $A();
    this.bboxesByKey = {};

    this.osmWayBboxPairs = $A();
  },
  /** 
   *  Clear all non accepted ways from the model and refresh all model structures
   */
  clearNonAcceptedWays: function () {

    // first clear junction
    var partitionedWays = this.osmWayBboxPairs.partition(function (osmWayBbox) {
      return !osmWayBbox.osmWay.isAccepted();
    });
  
    this.clearAll();
    var acceptedPairs = partitionedWays[1]; 
  
    var that = this;
    acceptedPairs.each(function (osmWayBboxItem) {
      that.addOsmWayBbox(osmWayBboxItem.osmWay, osmWayBboxItem.bbox);
    });
  },
  /** 
   *  Add all ways associated with the given bbox to the model
   *  @param bboxWays OsmWays that are associated with the bbox
   *  @param bbox OsmBbox associated with the given OsmWays
   */
  loadBboxOsmWays: function (/**Array*/ bboxWays, /**OsmBbox*/ bbox) {

    var that = this;
    var localBbox = bbox;
    bboxWays.each(function (osmWay) {
      that.addOsmWayBbox(osmWay, localBbox);
    });
  },
  /** 
   *  Return the calculated union of all bboxes in the model
   *  @return {OsmBbox} Return the calculated union of all bboxes in the model
   */
  bboxUnion: function () {

    var bboxUnion = undefined;
    if (this.bboxes.length > 0) {
      bboxUnion = new OsmBbox();
      bboxUnion.fillByOsmBbox(this.bboxes[0]);
      for (var i = 1, len = this.bboxes.length; i < len; ++i) {
        bboxUnion.growByBbox(this.bboxes[i]);
      }
    }
    return bboxUnion;
  }
}); //--BoundaryAppModel



/**
 Main object that manages the BoundaryApp application
 * @class 
 * @property {OsmLink} osmLink Manages communication with openstreetmap
 * @property {BoundaryAppViewer} viewer Manages display of way lists
 * @property {BoundaryAppModel} model Manages data model for the application
 * @property {BoundaryCalc} boundaryCalc Manages the boundary calculations
 * @property {Boolean} boundaryReady If boundary is ready, true
 * @property {Function} onMapClickBind Execute this on map click
 * @property {OsmGMap} osmGMap Manages display and interactivity of map
 * @property {AppEvents} osmWayEvents Manages events associated with ways
 * @property {AppEvents} viewerEvents Manages events associated with the view
 **/
var BoundaryApp = Class.create(
/** @scope BoundaryApp.prototype */
{
  /** @constructs */
  initialize: function () {
    this.osmLink = new OsmLink();
    this.viewer = new BoundaryAppViewer();
    this.model = new BoundaryAppModel();
    this.boundaryCalc = new BoundaryCalc(this.model);
    
    this.boundaryCalc.bboxSize = this.osmLink.bboxSize;
    this.boundaryReady = false;
    
    var onMapClickBind = this.onMapClick.bind(this);
    this.osmGMap = new OsmGMap('map', onMapClickBind);
    
    this.osmWayEvents = new AppEvents();
    this.setupOsmWayEvents();

    this.viewerEvents = new AppEvents();
    this.setupViewerEvents();    
    this.viewer.setEvents(this.viewerEvents);
  },
  /** 
   *  Setup OsmWay events
   */
  setupOsmWayEvents: function () {
    var onStateChangeBind = this.osmGMap.onStateChange.bind(this.osmGMap);
    var onRefreshBind = this.osmGMap.onRefreshOsmWay.bind(this.osmGMap);
    var onRemoveBind = this.osmGMap.onRemove.bind(this.osmGMap);
    var onWayNodesChangedBind = this.osmGMap.onWayNodesChanged.bind(this.osmGMap);

    this.osmWayEvents.addEventHandler(eWayEvents.onStateChanged, onStateChangeBind);
    this.osmWayEvents.addEventHandler(eWayEvents.onRefresh, onRefreshBind);
    this.osmWayEvents.addEventHandler(eWayEvents.onRemove, onRemoveBind);
    this.osmWayEvents.addEventHandler(
        eOsmWayEvents.onWayNodesChanged, onWayNodesChangedBind);
  },
  /** 
   *  Setup viewer events
   */
  setupViewerEvents: function () {
    var onDropAvailableBind = this.onLiDropAvailable.bind(this);
    var onDropAcceptedBind = this.onLiDropAccepted.bind(this);
    var onDropRejectedBind = this.onLiDropRejected.bind(this);
    var onDragStartBind = this.onLiDragStart.bind(this);
    var onDragStopBind = this.onLiDragStop.bind(this);

    this.viewerEvents.addEventHandler(eViewerEvents.onDropAvailable, onDropAvailableBind);
    this.viewerEvents.addEventHandler(eViewerEvents.onDropAccepted, onDropAcceptedBind);
    this.viewerEvents.addEventHandler(eViewerEvents.onDropRejected, onDropRejectedBind);
    this.viewerEvents.addEventHandler(eViewerEvents.onDragStart, onDragStartBind);
    this.viewerEvents.addEventHandler(eViewerEvents.onDragStop, onDragStopBind);
  },
  /** 
   *  Factory method for creating new OsmWays for this application
   */
  osmWayFactory: function () {
    return new BoundaryAppOsmWay();
  },
  /** 
   *  Eventhandler for drop of li element on available zone
   */
  onLiDropAvailable: function (eventData) {
    var osmWay = this.model.getOsmWayById(eventData.id);
    if (osmWay) {
      osmWay.changeState(eWayState.Available);
    }
  },
  /** 
   *  Eventhandler for drop of li element on accepted zone
   */
  onLiDropAccepted: function (eventData) {
    var osmWay = this.model.getOsmWayById(eventData.id);
    if (osmWay) {
      osmWay.changeState(eWayState.Accepted);
    }
  },
  /** 
   *  Eventhandler for drop of li element on rejected zone
   */
  onLiDropRejected: function (eventData) {
    var osmWay = this.model.getOsmWayById(eventData.id);
    if (osmWay) {
      osmWay.changeState(eWayState.Rejected);
    }
  },
  /** 
   *  Eventhandler for starting the drag of an li element 
   */
  onLiDragStart: function (eventData) {
    var osmWay = this.model.getOsmWayById(eventData.id);
    if (osmWay) {
      osmWay.startDrag();
    }
  },
  /** 
   *  Eventhandler for stopping the drag of an li element 
   */
  onLiDragStop: function (eventData) {
    var osmWay = this.model.getOsmWayById(eventData.id);
    if (osmWay) {
      osmWay.stopDrag();
    }
  },
  /** 
   *  Clear the view and update the model to prepare for the new user-click on map
   */
  clearForNextBbox: function () {
    this.viewer.clearAvailableWays();
    this.viewer.clearRejectedWays();
    
    var availableWays = this.model.getAvailableWays();
    availableWays.each(function (osmWay) {
      osmWay.remove();
    });
    this.model.clearNonAcceptedWays();
  },
  /** 
   *  Re-initialize the view and model
   */
  clearAll: function () {
    this.clearForNextBbox();
    this.viewer.clearAcceptedWays();
    
    var acceptedWays = this.model.getAcceptedWays();
    acceptedWays.each(function (osmWay) {
      osmWay.remove();
    });
    this.model.clearAll();
  },
  /** 
   *  Respond to DOM event to trim the borders formed by osmWays to create boundary
   */
  onTrimBorders: function () {
    this.clearForNextBbox();
    this.boundaryCalc.calculate();  
    this.boundaryCalc.refresh();
  },
  /** 
   *  Respond to DOM event to upload the calculated boundary (!!! work in progress)
   */
  onUploadBoundary: function () {
    this.boundaryReady = true;
    if (this.boundaryReady) {
      var xmlDoc = document.implementation.createDocument("", "", null);
      this.boundaryCalc.generateXml(xmlDoc);
    }
  },
  /** 
   *  Respond to DOM event of user clicking on the map
   *  @param xyPoint  Point where user clicked 
   */
  onMapClick: function (/**Object*/ xyPoint) {

    if (xyPoint) {
      this.osmGMap.displayLatLonCallout(xyPoint);
      
      var xmlDoc = this.osmLink.getClickPointData(xyPoint);
      if (xmlDoc) {
        this.clearForNextBbox();
      
    	  var osmBboxDoc = new OsmBboxDoc(this.osmWayFactory);
    	  osmBboxDoc.readOsmXml(xmlDoc);
    	  var bboxWays = osmBboxDoc.osmWays;
    	  var bbox = osmBboxDoc.osmBbox;
    	  
    	  this.model.loadBboxOsmWays(bboxWays, bbox);

        // new osmWays are loaded as unavailable - make them available
        var unavailableWays = this.model.getUnavailableWays();
        var localEvents = this.osmWayEvents;
        unavailableWays.each(function (osmWay) {
          osmWay.setEvents(localEvents);
          osmWay.changeState(eWayState.Available);
        });

        var availableWays = this.model.getAvailableWays();
        this.viewer.displayAvailableList(availableWays);
      }
    }
  },
  /** 
   *  Respond to DOM event display the address in the map
   */
  onShowAddress: function () {

    var address = $F($('frmAddr')['addr']);
    this.osmGMap.showAddress(address);
    return false;
  },
  /** 
   *  Respond to DOM event re-initialize the application
   */
  onStartOver: function () {

    this.clearAll();
  },
  /** 
   *  Respond to DOM event on divs to perform select of li element
   */
  onDivClick: function (event) {
    this.viewer.selectLi(event.target);
  },
  /** 
   *  Respond to DOM event after document load to enable other DOM events
   */
  onLoad: function () {

    if (this.osmGMap.canLoad()) {
      this.osmGMap.load();
      
      $('addrClick').observe('click', 
          boundaryApp.onShowAddress.bindAsEventListener(boundaryApp));
          
      $('trimClick').observe('click', 
          boundaryApp.onTrimBorders.bindAsEventListener(boundaryApp));
          
      $('uploadClick').observe('click', 
          boundaryApp.onUploadBoundary.bindAsEventListener(boundaryApp));
          
      $('startOverClick').observe('click', 
          boundaryApp.onStartOver.bindAsEventListener(boundaryApp));

      $('availableDiv').observe('click', 
          boundaryApp.onDivClick.bindAsEventListener(boundaryApp));

      $('acceptedDiv').observe('click', 
          boundaryApp.onDivClick.bindAsEventListener(boundaryApp));

      $('rejectedDiv').observe('click', 
          boundaryApp.onDivClick.bindAsEventListener(boundaryApp));

      this.viewer.load();
    }
  }
}); // --BoundaryApp


/**
 * This object instantiates the application
 * @field
 */  
var boundaryApp = new BoundaryApp();

/**
 * This function bootstraps the application upon loading
 * @function
 */  
$(document).observe('dom:loaded', 
    boundaryApp.onLoad.bindAsEventListener(boundaryApp));

/**
 * This function ends the application
 * @function
 */    
Event.observe(window, 'unload', function () {
	$(document).stopObserving('dom:loaded');
	GUnload();
});


