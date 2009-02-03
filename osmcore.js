/**
 * @fileOverview This file provides core support for OSM LatLons, Bboxes, and Way
 * including the ability to read this data from OSM XML obtained from
 * the 0.5 API using the map?bbox=... HTTP method  
 * @author Greg ONeill
 * @version 0.8
 */

// Help for JSLint
// prototype.js globals...
/*global Class $A */

/**
 * Helper object for performing Lat and Lon related calculations 
 * @class 
 **/
var LatLonUtils = Class.create(
/** @scope LatLonUtils.prototype */
{
  /** @constructs */
  initialize: function () {
  },
  /** 
   *  Finds degrees between two latitudes
   *  @param latRef Reference latitude   
   *  @param latCompare Comparison latitude   
   *  @returns {Number} Degrees between between two given latitudes with negative 
   *  sign indicating that the direction from reference to comparator is south   
   */
  degreesLatBetween: function (/**Number*/ latRef, /**Number*/ latCompare) {

    // note: negative result means comparator is south 
    // of reference else it means north
    var degreesBetween = latCompare - latRef; 
    return degreesBetween;   
  },
  /** 
   *  Finds degrees between between two longitudes
   *  @param lonRef Reference longitude   
   *  @param lonCompare Comparison longitude   
   *  @returns {Number} Degrees between two given longitudes with negative 
   *  sign indicating that the direction from reference to comparator is west. 
   *  Note: Since degrees can be measured in either direction, 
   *  the minimum degree separation is always chosen.         
   */
  degreesLonBetweenMin: function (/**Number*/ lonRef, /**Number*/ lonCompare) {
    // calc positive degrees west to anti-meridian
    //       var refDegreesWest = 180 + latRef; 
    //       var cmpDegreesWest = 180 + latCompare;
    // calc positive westward distance between 
    //   and then negate it to reflect direction
    //       return -(refDegreesWest - cmpDegreesWest); 
    // simplifies to...
    var degreesBetween = lonCompare - lonRef;
    
    // calculate minimum degrees between ref and compare
    if (degreesBetween > 180.0) {
      degreesBetween = degreesBetween - 360;
    } else if (degreesBetween < -180.0) {
      degreesBetween = degreesBetween + 360;
    }
    // note: negative result means comparator is west
    // of reference else it means east
    return degreesBetween;   
  },
  /** 
   *  Returns given latitude with degreesAdded
   *  @param lat Reference latitude   
   *  @param degreesAdded Degrees to add to lat  
   *  @returns {Number} Calculated latitude    
   */
  degreesLatAdd: function (/**Number*/ lat, /**Number*/ degreesAdded) {

    var calcLat = lat + degreesAdded; 
    return calcLat;
  },
  /** 
   *  Returns given longitutde with degreesAdded
   *  @param lon Reference longitutde   
   *  @param degreesAdded Degrees to add to lon  
   *  @returns {Number} Calculated latitude    
   */
  degreesLonAdd: function (/**Number*/ lon, /**Number*/ degreesAdded) {

    var calcLon = lon + degreesAdded;
    if (calcLon > 180.0) {
      calcLon = calcLon - 360;
    } else if (calcLon < -180.0) {
      calcLon = calcLon + 360;
    }

    return calcLon;
  },
  /** 
   *  Finds midpoint between two latitudes
   *  @param latRef Reference latitude   
   *  @param latCompare Comparison latitude   
   *  @returns {Number} Midpoint between two given latitudes    
   */
  degreesLatMidpoint: function (/**Number*/ latRef, /**Number*/ latCompare) {

    var degreesBetween = this.degreesLatBetween(latRef, latCompare); 
    var midLat = latRef + (degreesBetween / 2.0); 
    
    return midLat;
  },
  /** 
   *  Finds midpoint between two longitudes
   *  @param lonRef Reference longitude   
   *  @param lonCompare Comparison longitude   
   *  @returns {Number} Midpoint between two given longitudes   
   */
  degreesLonMidpoint: function (/**Number*/ lonRef, /**Number*/ lonCompare) {

    var degreesBetween = this.degreesLonBetweenMin(lonRef, lonCompare); 
    var midLon = lonRef + (degreesBetween / 2.0); 
    if (midLon < -180.0) {
      midLon = midLon + 360.0;
    } else if (midLon > 180.0) {
      midLon = midLon - 360.0;
    }
    return midLon;   
  },
  /** 
   *  Returns true if 2 lines, each formed by 2 latitudes, intersect
   *  @param minlat1 1st line lower latitude
   *  @param maxlat1 1st line upper latitude   
   *  @param minlat2 2nd line lower latitude
   *  @param maxlat2 2nd line upper latitude   
   *  @returns {Boolean} True indicates that the 2 lines intersect   
   */
  latsIntersect: function (
      /**Number*/ minlat1,
      /**Number*/ maxlat1,
      /**Number*/ minlat2,
      /**Number*/ maxlat2) {
  
    var latsIntersect = false;
    if ((minlat1 <= minlat2 && minlat2 <= maxlat1) ||
        (minlat1 <= maxlat2 && maxlat2 <= maxlat1)) {
      latsIntersect = true;
    }
    return latsIntersect;
  },
  /** 
   *  Returns true if 2 lines, each formed by 2 longitudes, intersect
   *  @param minlon1 1st line lower longitude
   *  @param maxlon1 1st line upper longitude  
   *  @param minlon2 2nd line lower longitude
   *  @param maxlon2 2nd line upper longitude  
   *  @returns {Boolean} True indicates that the 2 lines intersect   
   */
  lonsIntersect: function (
      /**Number*/ minlon1,
      /**Number*/ maxlon1,
      /**Number*/ minlon2,
      /**Number*/ maxlon2) {
  
    var degrees1 = this.degreesLonBetweenMin(minlon1, maxlon2);
    var degrees2 = this.degreesLonBetweenMin(maxlon1, minlon2);
    // if the sign of difference product is the same, no intersection
    if (degrees1 * degrees2 > 0) {
      return false;
    } else {
      return true;
    }
  }
}); // --LatLonUtils

/**
 * Makes helper object LatLonUtils available for other Classes
 * @field
 */ 
var latLonUtils = new LatLonUtils();

/**
 * Helper object for performing Lat and Lon related calculations 
 * @class 
 * @property {Number} lat Latitude of point  
 * @property {Number} lon Longitude of point  
 **/
var LatLon = Class.create(
/** @scope LatLon.prototype */
{
  /** @constructs 
   *  @param lat Latitude of point
   *  @param lon Longitude of point
   */
  initialize: function (/**Number*/ lat, /**Number*/ lon) {
    this.lat = lat;
    this.lon = lon;
  },
  /** 
   *  Returns distance in *degrees* between 2 LatLons
   *  OK, OK, this is very hinkey, but is fine for very short distances (<1km)
   *  especially if it is only used for comparison to find the nearest
   *  2 points. 
   *  @param latLon Comparator LatLon for distance calculation   
   *  @returns {Number} *Degrees* between this and given LatLon         
   */
  distancePythagorean: function (/**LatLon*/ latLon) {
    // d = sqrt((X2 - X1)^2 + (Y2 - Y1)^2)
    var latBetween = latLonUtils.degreesLatBetween(this.lat, latLon.lat);
    var lonBetween = latLonUtils.degreesLonBetweenMin(this.lon, latLon.lon);
    var yterm = Math.pow(latBetween, 2);
    var xterm = Math.pow(lonBetween, 2);
    var distance = Math.sqrt(yterm + xterm);
    return distance;
  },
  /** 
   *  Returns true if latLon is 'near' this 
   *  @param latLon Comparator LatLon for 'near' calculation   
   *  @param bboxSize Criteria distance for 'near' calculation   
   *  @returns {Boolean} True if near within bboxSize, else false
   */
  isNear: function (/**LatLon*/ latLon, /**Number*/ bboxSize) {
    var isNear = false;
    var latBetween = latLonUtils.degreesLatBetween(this.lat, latLon.lat);
    var lonBetween = latLonUtils.degreesLonBetweenMin(this.lon, latLon.lon);
    if (Math.abs(latBetween) <= bboxSize && Math.abs(lonBetween) <= bboxSize) {
      isNear = true;
    }
    return isNear;
  },
  /** 
   *  Returns midpoint LatLon between given latLon and this 
   *  @param latLon Comparator LatLon for midpoint calculation   
   *  @returns {LatLon} Midpoint between given latLon and this
   */
  midpoint: function (/**LatLon*/ latLon) {
    var latMidpoint = latLonUtils.degreesLatMidpoint(this.lat, latLon.lat);
    var lonMidpoint = latLonUtils.degreesLonMidpoint(this.lon, latLon.lon);
    var midpoint = new LatLon(latMidpoint, lonMidpoint);
    
    return midpoint;
  }
});  // --LatLon

/**
 * Bounding box object corresponding to OSM bbox xml <bounds> data
 * @class
 * property {Number} minlat Minimum or South-most or bottom latitude 
 * property {Number} minlon Minimum or West-most or left latitude 
 * property {Number} maxlat Maximum or North-most or top longitude 
 * property {Number} maxlon Maximum or East-most or right longitude 
 **/
var OsmBbox = Class.create(
/** @scope OsmBbox.prototype */
{
  /** @constructs */
  initialize: function () {
    this.minlat = undefined;
    this.minlon = undefined;
    this.maxlat = undefined;
    this.maxlon = undefined;
  },
  
  /** 
   *  Fills 'this' with given individual lats and lons 
   *  @param minlat Minimum or South-most or bottom latitude   
   *  @param minlon Minimum or West-most or left latitude   
   *  @param maxlat Maximum or North-most or top longitude   
   *  @param maxlon Maximum or East-most or right longitude   
   */
  fillByCoordinates: function (
      /**Number*/ minLat, 
      /**Number*/ minLon, 
      /**Number*/ maxLat, 
      /**Number*/ maxLon) {

    // juggle input parameter so that min/max corresponds to sw/ne (or bl/tr)
    if (minLat > maxLat) {
      this.maxlat = minLat;
      this.minlat = maxLat;
    } else {
      this.maxlat = maxLat;
      this.minlat = minLat;
    }
    var degreesBetween = 
      latLonUtils.degreesLonBetweenMin(minLon, maxLon);
      
    if (degreesBetween < 0) {
      this.maxlon = minLon;
      this.minlon = maxLon;
    } else {
      this.maxlon = maxLon;
      this.minlon = minLon;
    }
  },
  /** 
   *  Fills 'this' with given OsmBbox 
   *  @param osmBbox Bbox to be cloned   
   */
  fillByOsmBbox: function (/**OsmBbox*/osmBbox) {
    this.minlat = osmBbox.minlat;
    this.minlon = osmBbox.minlon;
    this.maxlat = osmBbox.maxlat;
    this.maxlon = osmBbox.minlon;
  },
  /** 
   *  Fills 'this' with given xy point as center of bbox of bboxSize 
   *  @param xyPoint xyPoint corresponding to center of Bbox to be created   
   *  @param bboxSize Size of square bbox to be created centered on xyPoint   
   */
  fillByXYPoint: function (/**XYPoint*/ xyPoint, /**Number*/ bboxSize) {
    var offset = bboxSize / 2.0;
    this.minlat = latLonUtils.degreesLatAdd(xyPoint.y, -offset);
    this.minlon = latLonUtils.degreesLonAdd(xyPoint.x, -offset);
    this.maxlat = latLonUtils.degreesLatAdd(xyPoint.y, offset);
    this.maxlon = latLonUtils.degreesLonAdd(xyPoint.x, offset);
  },
  /** 
   *  Fills 'this' with given latLon as center of bbox of bboxSize 
   *  @param latLon xyPoint corresponding to center of Bbox to be created   
   *  @param bboxSize Size of square bbox to be created centered on latLon   
   */
  fillByMidpointLatLon: function (/**LatLon*/ latLon, /**Number*/ bboxSize) {
    var offset = bboxSize / 2.0;
    this.minlat = latLonUtils.degreesLatAdd(latLon.lat, -offset);
    this.minlon = latLonUtils.degreesLonAdd(latLon.lon, -offset);
    this.maxlat = latLonUtils.degreesLatAdd(latLon.lat, offset);
    this.maxlon = latLonUtils.degreesLonAdd(latLon.lon, offset);
  },
  /** 
   *  Fills 'this' with given {@link XmlDoc} node having the 'Bounds' tag
   *  @param xmlDocBoundsElement Element within XmlDoc containing <bounds> tag
   */
  fillByOsmXml: function (xmlDocBoundsElement) { 
    var boundsAttributes = xmlDocBoundsElement.attributes;
    for (var i = 0, len = boundsAttributes.length; i < len; ++i) {
      if (this.minlat && this.minlon && this.maxlat && this.maxlon) {
        break;
      } else if (boundsAttributes[i].nodeName === "minlat") {
        this.minlat = Number(boundsAttributes[i].nodeValue);
      } else if (boundsAttributes[i].nodeName === "minlon") {
        this.minlon = Number(boundsAttributes[i].nodeValue);
      } else if (boundsAttributes[i].nodeName === "maxlat") {
        this.maxlat = Number(boundsAttributes[i].nodeValue);
      } else if (boundsAttributes[i].nodeName === "maxlon") {
        this.maxlon = Number(boundsAttributes[i].nodeValue);
      }
    }
  },
  /** 
   *  Fills 'this' with given latLons which are evaluated to determine
   *  South-West (Bottom-Left) and North-East (Top-Right).     
   *  @param latLon1 1st of 2 LatLons   
   *  @param latLon2 2nd of 2 LatLons     
   */
  fillByLatLons: function (/**LatLon*/ latLon1, /**LatLon*/ latLon2) {
  
    this.fillByCoordinates(latLon1.lat, latLon1.lon, latLon2.lat, latLon2.lon);
  },
  /** 
   *  Returns true if lat is contained by 'this'     
   *  @param lat Latitude to be compared with 'this'   
   *  @returns True if lat is contained by 'this'       
   */
  containsLat: function (/**Number*/ lat) {

    var contains = false;
    if ((this.minlat <= lat) && (lat <= this.maxlat)) {
      contains = true;
    }
    return contains;   
  },
  /** 
   *  Returns true if lon is contained by 'this'     
   *  @param lon Longitude to be compared with 'this'   
   *  @returns True if lon is contained by 'this'       
   */
  containsLon: function (/**Number*/ lon) {

    var contains = false;
    if (this.minlon < this.maxlon) { // the normal case
      if ((this.minlon <= lon) && (lon <= this.maxlon)) {
        contains = true;
      }
    } else { // this straddles the anti-meridian
      if ((lon >= this.minlon) || (lon <= this.maxlon)) {
        contains = true;
      }
    }
    return contains;   
  },
  /** 
   *  Returns true if latLon is enclosed by 'this'     
   *  @param latLon LatLon point to be compared with 'this'   
   *  @returns True if latLon is enclosed by 'this'       
   */
  enclosesLatLon: function (/**LatLon*/ latLon) {
    // return true if the given point is within bounds
    // note: lat and lon must be numbers
    var encloses = false;
    if (this.containsLat(latLon.lat) && this.containsLon(latLon.lon)) {
      encloses = true; 
    }
    return encloses;   
  },
  /** 
   *  Returns true if given osmBbox is equal to 'this'     
   *  @param osmBbox OsmBbox to be compared with 'this'   
   *  @returns True if OsmBbox has equal coordinates to 'this'       
   */
  equals: function (/**OsmBbox*/ osmBbox) {
    
    var equals = false;
    if (this.minlat === osmBbox.minlat && 
        this.minlon === osmBbox.minlon &&
        this.maxlat === osmBbox.maxlat &&
        this.maxlon === osmBbox.maxlon) {
      equals = true; 
    }
    return equals;   
  },
  /** 
   *  Returns true if given osmBbox intersects 'this'     
   *  @param osmBbox OsmBbox to be compared with 'this'   
   *  @returns True if OsmBbox intersects with 'this'       
   */
  intersects: function (/**OsmBbox*/ osmBbox) {
    
    var intersects = false;
    if (
      latLonUtils.latsIntersect(
        this.minlat, this.maxlat, osmBbox.minlat, osmBbox.maxlat) &&
      latLonUtils.lonsIntersect(
        this.minlon, this.maxlon, osmBbox.minlon, osmBbox.maxlon)) {
      intersects = true; 
    }
    return intersects;   
  },
  /** 
   *  Returns unique single number representing minlat and minlon of 'this' 
   *  Note: This enables fast id comparison and sortings, but yes, hinkey       
   *  @returns {Number}       
   */
  key: function () {
    var key = (this.minlon * 1000000000.0) + this.minlat;
    return key;
  },
  /** 
   *  Grows 'this' to enclose given latLon
   *  @param latLon LatLon point to be enclosed by 'this' by growing 'this'
   */
  growByLatLon: function (/**LatLon*/ latLon) {
  
    var degreesBetween = 0.0;
    
    // test for growth to the north
    degreesBetween = latLonUtils.degreesLatBetween(
      this.maxlat, latLon.lat);      
    if (degreesBetween > 0) {
      this.maxlat = latLon.lat;
    }
    // test for growth to the south
    degreesBetween = latLonUtils.degreesLatBetween(
      this.minlat, latLon.lat);      
    if (degreesBetween < 0) {
      this.minlat = latLon.lat;
    }
    // test for growth to the east   
    degreesBetween = latLonUtils.degreesLonBetweenMin(
      this.maxlon, latLon.lon);      
    if (degreesBetween > 0) {
      this.maxlon = latLon.lon;
    }
    // test for growth to the west
    degreesBetween = latLonUtils.degreesLonBetweenMin(
      this.minlon, latLon.lon);      
    if (degreesBetween < 0) {
      this.minlon = latLon.lon;
    }
  },
  /** 
   *  Grows 'this' to enclose given osmBbox
   *  @param osmBbox OsmBbox to be enclosed by growing 'this'
   */
  growByBbox: function (/**OsmBbox*/ osmBbox) {
  
    var degreesBetween = 0.0;
    
    // test for growth to the north
    degreesBetween = latLonUtils.degreesLatBetween(
      this.maxlat, osmBbox.maxlat);      
    if (degreesBetween > 0) {
      this.maxlat = osmBbox.maxlat;
    }
 
    // test for growth to the south
    degreesBetween = latLonUtils.degreesLatBetween(
      this.minlat, osmBbox.minlat);      
    if (degreesBetween < 0) {
      this.minlat = osmBbox.minlat;
    }
 
    // test for growth to the east   
    degreesBetween = latLonUtils.degreesLonBetweenMin(
      this.maxlon, osmBbox.maxlon);      
    if (degreesBetween > 0) {
      this.maxlon = osmBbox.maxlon;
    }
 
    // test for growth to the west
    degreesBetween = latLonUtils.degreesLonBetweenMin(
      this.minlon, osmBbox.minlon);      
    if (degreesBetween < 0) {
      this.minlon = osmBbox.minlon;
    }
  }
}); // --OsmBbox

/**
 * Osm point object strangely called a Node (which is particularly
 * confusing when doing DOM work ). An array of these is the core of 
 * {@link OsmWay} 
 * @class 
 * @property {Number} id Node (point) id  
 * @property {LatLon} latLon LatLon point of this node  
 **/
var OsmNode = Class.create(
/** @scope OsmNode.prototype */
{
  /**
   *  @constructs
   * @param {Object} osmXmlDocElement Latitude of point  
   * @param {Number} id Node (point) id  
   * @param {Number} lat Node latitude  
   * @param {Number} lon Node longitude  
   */
  initialize: function (osmXmlDocElement, id, lat, lon) {
    this.id = undefined;
    this.latLon = undefined;
    this.fillProperties(osmXmlDocElement);
  },
  /** 
   *  Return latitude for 'this'
   *  @returns Latitude for 'this'
   */
  lat: function () {
    return this.latLon.lat;
  },
  /** 
   *  Return longitude for 'this'
   *  @returns Longitude for 'this'
   */
  lon: function () {
    return this.latLon.lon;
  },
  /** 
   *  Fills 'this' with given individual lats and lons 
   *  @param osmXmlDocElement Element of {@link XmlDoc} containing <Node> tag   
   */
  fillProperties: function (/**Object*/ osmXmlDocElement) { 
    
    var lat = undefined;
    var lon = undefined;
    var nodeAttributes = osmXmlDocElement.attributes;
    
    for (var i = 0, len = nodeAttributes.length; i < len; ++i) {
      if (this.id && lat && lon) {
        break;
      } else if (nodeAttributes[i].nodeName === "id") {
        this.id = Number(nodeAttributes[i].nodeValue);
      } else if (nodeAttributes[i].nodeName === "lat") {
        lat = Number(nodeAttributes[i].nodeValue);
      } else if (nodeAttributes[i].nodeName === "lon") {
        lon = Number(nodeAttributes[i].nodeValue);
      }
    }
    this.latLon = new LatLon(lat, lon);
  },
  /** 
   *  Returns LatLon for this node 
   *  @returns {LatLon} LatLon point for this node   
   */
  getLatLon: function () {
    return this.latLon;
  }
}); // --OsmNode

/**
 * Represents {@link OsmWay} <Tag>  Element (which is a child of OsmWay)
 * @class 
 * @property {String} k Indicates that this attribute is the name of the tag  
 * @property {String} v Indicates that this attribute is the value of the tag
 **/
var OsmWayTag = Class.create(
/** @scope OsmWayTag.prototype */
{
  /**
   * @constructs
   * @param {Object} osmWayTagElement {@link XmlDoc} <way><tag> element  
   */   
  initialize: function (osmWayTagElement) {
    this.k = undefined;
    this.v = undefined;
    
    // !!! assumes/requires that 1st attr is k and 2nd attr is v
    if (osmWayTagElement.attributes.item(0).nodeName === 'k') {
      this.k = osmWayTagElement.attributes.item(0).nodeValue;
    }
    if (osmWayTagElement.attributes.item(1).nodeName === 'v') {
      this.v = osmWayTagElement.attributes.item(1).nodeValue;
    }
  }
}); // --OsmWayTag


/**
 * This object acts as the enum for OsmWay events
 * @field
 */  
var eOsmWayEvents = {onWayNodesChanged: 'onWayNodesChanged'};

/**
 * Represents data in the <Way> tag Element of {@link XmlDoc} 
 * @class 
 * @property {Number} id Id of the Way 
 * @property {String} name Name of the Way (maybe composed of leftName:rightName)
 * @property {String} leftName If present, leftName attribute <Way><Tag> Element 
 * @property {String} rightName If present, rightName attribute <Way><Tag> Element
 * @property {Array} wayNodeRefs Array of <Way><nd> element data
 * @property {Array} wayNodes Array of <osm><node> element data based on this.wayNodeRefs
 * @property {Array} wayTags xyz
 * @property {String} osmXmlWay XML associated with this way
 * @property {AppEvents} events {@link AppEvents} associated with the the object
 **/
var OsmWay = Class.create(
/** @scope OsmWay.prototype */
{
  /**@constructs*/
  initialize: function () {
    this.id = null;
    this.name = undefined;
    this.leftName = undefined;
    this.rightName = undefined;
    this.wayNodeRefs = $A([]);
    this.wayNodes = $A([]);
    this.wayTags = $A();
    this.osmXmlWay = null;
    this.events = undefined;
  },
  /** 
   *  Sets up events for this object 
   *  @param events AppEvents object containing eventHandlers   
   */
  setEvents: function (/**AppEvents*/ events) {
    this.events = events;
  },
  /** 
   *  Calculates and returns a bbox which encloses this.wayNodes 
   *  @returns {OsmBbox} Bbox which encloses this.wayNodes   
   */
  getWayNodesBbox: function () {
    // calculate bounds for the waynodes
    
    var bbox = new OsmBbox();
    
    // initialize the bbox with the first 2 latlons
    var latLon1 = this.getLatLonAtIndex(0);
    var latLon2 = this.getLatLonAtIndex(1);
    bbox.fillByLatLons(latLon1, latLon2);
    
    // grow the bbox with the remaining latlons
    for (var i = 2, len = this.wayNodes.length; i < len; ++i) {
      latLon1 = this.getLatLonAtIndex(i);
      bbox.growByLatLon(latLon1);
    }
    return bbox;
  },
  /** 
   *  Returns LatLon of wayNode at given index 
   *  @param index Index into this.wayNodes   
   *  @returns {LatLon} LatLon of wayNode at given index   
   */
  getLatLonAtIndex: function (/**Number*/ index) {
    var latLon = undefined;
    try {
      latLon = this.wayNodes[index].latLon;
      return latLon;
    } catch (err) {
      return latLon;
    }
  },
  /** 
   *  Removes from this.wayNodes from iterators curr position to end
   *  @param {OsmWayEndpointIterator} osmWayEndpointIterator Iterator to traverse wayNodes   
   *  @param {Boolean} keepCurrFlag If true, keep data at curr position, else trim it   
   */
  trimWayNodesFar: function (osmWayEndpointIterator, keepCurrFlag) {
    var excludeCurrFlag = undefined;
    if (keepCurrFlag && keepCurrFlag === false) {
      excludeCurrFlag = true;
    }
    this.wayNodes = osmWayEndpointIterator.getNearSlice(excludeCurrFlag);
    var that = this;
    if (this.events) {
      this.events.fire(eOsmWayEvents.onWayNodesChanged, {osmWay: that});
    }
  },
  /** 
   *  Removes from this.wayNodes from iterators beginning to curr position
   *  @param {OsmWayEndpointIterator} osmWayEndpointIterator Iterator to traverse wayNodes   
   *  @param {Boolean} keepCurrFlag If true, keep data at curr position, else trim it   
   */
  trimWayNodesNear: function (osmWayEndpointIterator, keepCurrFlag) {
    var excludeCurrFlag = undefined;
    if (keepCurrFlag && keepCurrFlag === false) {
      excludeCurrFlag = true;
    }
    this.wayNodes = osmWayEndpointIterator.getFarSlice(excludeCurrFlag);
    var that = this;
    if (this.events) {
      this.events.fire(eOsmWayEvents.onWayNodesChanged, {osmWay: that});
    }
  },
  /** 
   *  Returns as numeric the ref attribute value for the given <way><nd> element
   *  @param {Object} wayNdChildElement <way><nd> element from {@link XmlDoc}   
   *  @returns {Number} Reference to <osm><node> element in {@link XmlDoc} 
   */
  getWayNodeRef: function (wayNdChildElement) {
    // !!! assumes node is "nd" and 1st attribute is "ref"
    return Number(wayNdChildElement.attributes.item(0).nodeValue);
  },
  /** 
   *  Returns true if element look like <way><tag> element having k and v attributes
   *  @param {Object} wayTagChildElement <way><tag> element from {@link XmlDoc}   
   *  @returns {Boolean} true if element look like <way><tag> element having k and v attributes   
   */
  isKvNode: function (wayTagChildElement) {
    // !!! assumes node is "tag" 
    if (wayTagChildElement.attributes.item(0).nodeName === 'k' && 
      wayTagChildElement.attributes[1].nodeName === 'v') {
      return true;
    } else { 
      return false; 
    }
  },
  /** 
   *  Returns value for leftName attribute of <way><tag> element from {@link XmlDoc}
   *  or undefined if it is not present   
   *  @param {Object} wayTagChildElement <way><tag> element from {@link XmlDoc}   
   *  @returns {String} Value of leftName attribute or undefined if not present
   */
  getWayLeftName: function (/**Object*/wayTagChildElement) {
    // !!! assumes node is "tag" 
    if (this.isKvNode(wayTagChildElement) &&
      wayTagChildElement.attributes.item(0).nodeValue.match('left') === 'left') {
      return wayTagChildElement.attributes.item(1).nodeValue;
    } else { 
      return undefined; 
    }
  },
  /** 
   *  Returns value for rightName attribute of <way><tag> element from {@link XmlDoc}
   *  or undefined if it is not present   
   *  @param {Object} wayTagChildElement <way><tag> element from {@link XmlDoc}   
   *  @returns {String} Value of leftName attribute or undefined if not present   
   */
  getWayRightName: function (/**Object*/wayTagChildElement) {
    // !!! assumes node is "tag" 
    if (this.isKvNode(wayTagChildElement) &&
      wayTagChildElement.attributes.item(0).nodeValue.match('right') === 'right') {
      return wayTagChildElement.attributes.item(1).nodeValue;
    } else { 
      return undefined; 
    }
  },
  /** 
   *  Returns value for name attribute of <way><tag> element from {@link XmlDoc}
   *  or undefined if it is not present   
   *  @param {Object} wayTagChildElement <way><tag> element from {@link XmlDoc}   
   *  @returns {String} Value of name attribute or undefined if not present   
   */
  getWayName: function (/**Object*/ wayTagChildElement) {
    // !!! assumes node is "tag" 
    if (this.isKvNode(wayTagChildElement) &&
      wayTagChildElement.attributes.item(0).nodeValue === 'name') {
      return wayTagChildElement.attributes.item(1).nodeValue;
    } else { 
      return undefined; 
    }
  },
  /** 
   *  Fills (partially) 'this' OsmWay object by traversing data in the <way> element   
   *  @param osmXmlWayElement <osm><way> element from {@link XmlDoc}   
   */
  fillByWayElement: function (/**Object*/ osmXmlWayElement) {
    // !!! assume id = 1st attr
    this.id = Number(osmXmlWayElement.attributes.item(0).nodeValue); 
    this.osmXmlWay = osmXmlWayElement;
    var wayChildNodes = this.osmXmlWay.childNodes;
    var wayChildNode = undefined;
    var iRef = 0;
    
    // collect refs and grab way name
    for (var i = 0, len = wayChildNodes.length; i < len; ++i) {
      wayChildNode = wayChildNodes[i];
      if (wayChildNode.tagName === "nd") {
        this.wayNodeRefs[iRef] = this.getWayNodeRef(wayChildNode);
        iRef++;
      } else if (!this.name && wayChildNode.tagName === "tag") {
        this.wayTags.push(new OsmWayTag(wayChildNode));
        this.name = this.getWayName(wayChildNode);
        if (!this.leftName) {
          this.leftName = this.getWayLeftName(wayChildNode);
        }
        if (!this.rightName) {
          this.rightName = this.getWayRightName(wayChildNode);
        }
      }
    }
    
    if (!this.name) {
      this.name = this.leftName + ":" + this.rightName;
    }
    this.wayNodeRefs = this.wayNodeRefs.compact();
  },
  /** 
   *  Find item in {@link OsmNode} array having the given id
   *  @param osmNodes Array of wayNodes   
   *  @param id Searched-for id within osmNodes  
   *  @returns {OsmNode} Found node or undefined if not found    
   */
  findWayNodeById: function (/**Array*/ osmNodes, id) {
    var localId = id;
    var osmNode = osmNodes.find(function (osmNode) {
      return (osmNode.id === localId); 
    });
    return osmNode;
  },
  /** 
   *  Sets this.wayNodes to the given osmNodes
   *  @param osmNodes Array of {@link OsmNode}   
   */
  setWayNodes: function (/**Array*/ osmNodes) {
    var id = undefined;
    var osmNode = undefined;
    var iWayNode = 0;
    
    for (var i = 0, len = this.wayNodeRefs.length; i < len; ++i) {
      id = this.wayNodeRefs[i];
      osmNode = this.findWayNodeById(osmNodes, id);
      if (osmNode) {
        this.wayNodes[iWayNode] = osmNode;
        iWayNode++;
      }
    }
  }
}); // --OsmWay

/**
 * Constructs array of {@link OsmWay} by traversing {@link XmlDoc} 
 * @class 
 * @property {OsmBbox} OsmBbox based on data from <bounds> tag of (OSM XML 0.5 API)
 * @property {XmlDoc} xmlDoc XmlDoc based on OSM XML based on 0.5 API
 * @property {Array} osmNodes Array of <osm><node>
 * @property {Array} osmWays Array of <osm><node> data based on <way><nd> data
 * @property {Function} osmWayFactory Returns an OsmWay derived object
 **/
var OsmBboxDoc = Class.create(
/** @scope OsmBboxDoc.prototype */
{
  /**
   * @constructs
   * @param {Function} osmWayFactory Function that creates the Way object  
   */   
  initialize: function (osmWayFactory) {
    this.osmBbox = undefined;
    this.xmlDoc = null;
    this.osmNodes = $A([]);
    this.osmWays = $A([]);
    this.wayName = undefined;
    // returns new OsmWay/OsmWay-derived object
    this.osmWayFactory = osmWayFactory; 
  },
  /** 
   *  Fill the object from data in the xmlDoc
   *  @param xmlDoc DOM generated by DOMParser of OSM XML   
   */
  readOsmXml: function (/**XmlDoc*/ xmlDoc) { 

    this.xmlDoc = xmlDoc;
    var osmXmlNodes = xmlDoc.doc.firstChild.childNodes;
    
    // acquire nodes and ways and bounds from osm doc
    for (var i = 0, len = osmXmlNodes.length; i < len; ++i) {
      var osmXmlNode = osmXmlNodes[i];
      if (osmXmlNode.tagName === "node") {      
        this.osmNodes.push(new OsmNode(osmXmlNode));
        
      } else if (osmXmlNode.tagName === "way") {
        var osmWay = this.osmWayFactory();
        osmWay.fillByWayElement(osmXmlNode);
        this.osmWays.push(osmWay);
        
      } else if (osmXmlNode.tagName === "bounds") {
        this.osmBbox = new OsmBbox();
        this.osmBbox.fillByOsmXml(osmXmlNode);
      }
    }
    // assign nodes to way based on already-read node-refs
    //   and associate every way with the current bbox
    var osmNodes = this.osmNodes;
    this.osmWays.each(function (osmWay) {
      osmWay.setWayNodes(osmNodes);
    });
  }
}); // --OsmBboxDoc
