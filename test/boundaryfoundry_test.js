
var testCase_utilities = new YAHOO.tool.TestCase({

  name: "Utilities Test", 
 
  // setup and teardown  
  setUp : function () { 
    this.testArray = [0,1,2,3,4,5,6,7];
    this.iterator = new ArraySectionIterator(this.testArray,6,2);
    this.arrayIterator = new ArrayIterator(this.testArray);
    this.xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?> <osm version=\"0.5\" generator=\"OpenStreetMap server\"> <bounds minlat=\"40.018\" minlon=\"-75.523\" maxlat=\"40.021\" maxlon=\"-75.52\"/> </osm>";
    
  },   
  tearDown : function () { 
  },
  
  testArraySectionIterator: function () { 
    YAHOO.util.Assert.areEqual(6, this.iterator.first(), "First item should be 6"); 
    YAHOO.util.Assert.areEqual(5, this.iterator.next(), "The next item should be 5"); 
    YAHOO.util.Assert.areEqual(4, this.iterator.next(), "The next item should be 4"); 
    YAHOO.util.Assert.areEqual(3, this.iterator.next(), "The next item should be 3"); 
    YAHOO.util.Assert.areEqual(2, this.iterator.next(), "The next item should be 2"); 
    YAHOO.util.Assert.isUndefined(this.iterator.next(), "The next item should be undefined"); 
  },
  
  testArrayIterator: function () { 
    YAHOO.util.Assert.areEqual(0, this.arrayIterator.first(), "First item should be 0"); 
    YAHOO.util.Assert.areEqual(1, this.arrayIterator.next(), "The next item should be 1"); 
    YAHOO.util.Assert.areEqual(2, this.arrayIterator.next(), "The next item should be 2"); 
    YAHOO.util.Assert.areEqual(3, this.arrayIterator.next(), "The next item should be 3"); 
    YAHOO.util.Assert.areEqual(4, this.arrayIterator.next(), "The next item should be 4"); 
    YAHOO.util.Assert.areEqual(5, this.arrayIterator.next(), "The next item should be 5"); 
    YAHOO.util.Assert.areEqual(6, this.arrayIterator.next(), "The next item should be 6"); 
    YAHOO.util.Assert.areEqual(7, this.arrayIterator.next(), "The next item should be 7"); 
    YAHOO.util.Assert.isUndefined(this.arrayIterator.next(), "The next item should be undefined"); 
  },
  
  getXmlDoc: function () {
    this.xmlDoc = new XmlDoc(this.xml);
    return this.xmlDoc;
  },
  
  getBounds: function () {
    var osmXmlNodes = this.xmlDoc.doc.firstChild.childNodes;
    return osmXmlNodes[0].tagName;
  },
  
  testXmlDocContent: function () { 
    YAHOO.util.Assert.isNotUndefined(this.getXmlDoc(), "This should result in an object"); 
    YAHOO.util.Assert.areEqual("bounds", this.getBounds(), "This should return the text for <bounds>"); 
  },
  
  getAppEvents: function () {
    this.events = new AppEvents();
    this.eventcounter = 0;
    this.eventcounterbind = this.incrementEventcounter.bind(this);
    return this.events;
  },
  
  incrementEventcounter: function () {
    this.eventcounter += 1;
  },
  
  doFire: function () {
    this.events.fire("test");
    return this.eventcounter;
  },
  
  doFire: function (action) {
    if (action==="add") {this.events.addEventHandler("test", this.eventcounterbind);}
    if (action==="remove") {this.events.removeEventHandler("test", this.eventcounterbind);}
    this.events.fire("test");
    return this.eventcounter;
  },
  
  testAppEvents: function () { 
    YAHOO.util.Assert.isNotUndefined(this.getAppEvents(), "This should result in an object"); 
    YAHOO.util.Assert.isFalse(this.events.exists("test"), "This should return false");
    YAHOO.util.Assert.areEqual(1, this.doFire("add"), "This should return 1");
    YAHOO.util.Assert.isTrue(this.events.exists("test"), "This should return true");
    YAHOO.util.Assert.areEqual(2, this.doFire(""), "This should return 2");
    YAHOO.util.Assert.areEqual(2, this.doFire("remove"), "This should return 2");
    YAHOO.util.Assert.isFalse(this.events.exists("test"), "This should return false");
  }
}); 

var testCase_osmcore = new YAHOO.tool.TestCase({

  name: "OsmCore Test", 
 
  // setup and teardown  
  setUp : function () { 
    this.latLon1 = new LatLon(10, 10);
    this.latLon2 = new LatLon(-10, -10);
    var bboxLatLon = new LatLon(0,-180)
    this.osmBbox1 = new OsmBbox();
    this.osmBbox2 = new OsmBbox();
    this.osmBbox1.fillByMidpointLatLon(bboxLatLon, 20);
    this.osmBbox2.fillByMidpointLatLon(bboxLatLon, 20);
  },   
  tearDown : function () { 
  },
  
  checkMidpoint1: function () {
    var midLatLon = this.latLon1.midpoint(this.latLon2);
    if (midLatLon.lat === 0 && midLatLon.lon === 0) {
      return true;
    }
    else {
      return false;
    }
  },
  
  checkMidpoint2: function () {
    this.latLon1.lat = -10;
    this.latLon1.lon = -170
    this.latLon2.lat = -30;
    this.latLon2.lon = 170
    var midLatLon = this.latLon1.midpoint(this.latLon2);
    if (midLatLon.lat === -20 && midLatLon.lon === -180) {
      return true;
    }
    else {
      return false;
    }
  },
  
  testMidpoint: function () { 
    YAHOO.util.Assert.isTrue(this.checkMidpoint1(), "LatLon midpoint should be 0,0"); 
    YAHOO.util.Assert.isTrue(this.checkMidpoint2(), "LatLon midpoint should be 0,0"); 
  },
  
  testIntersect1: function () {
    this.osmBbox2.fillByCoordinates(-15,175,5,-165);
    YAHOO.util.Assert.isTrue(this.osmBbox1.intersects(this.osmBbox2), "The boxes should intersect"); 
  },
  
  testIntersect2: function () {
    this.osmBbox2.fillByCoordinates(10,-80,20,-70);
    YAHOO.util.Assert.isFalse(this.osmBbox1.intersects(this.osmBbox2), "The boxes should not intersect"); 
  }
}); 





var oSuite = new YAHOO.tool.TestSuite("TestSuite Name"); 
oSuite.add(testCase_utilities); 
oSuite.add(testCase_osmcore); 
	
YAHOO.tool.TestRunner.add(oSuite);

