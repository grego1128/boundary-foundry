/**
 * @fileOverview This file provides general utilties
 * @author Greg ONeill</a>
 * @version 0.8
 */

// Help for JSLint
/*global Class DOMParser */

/**
 * Create a document from XML using DOMParser 
 * @class 
 * @property {Object} doc The DOM version of the xml. 
 **/
var XmlDoc = Class.create(
/** @scope XmlDoc.prototype */
{
  /** 
   *  @constructs   
   *  @param xml The XML to be parsed into a DOM object  
   */
  initialize: function (/**String*/ xml) {
  
    // remove whitespace between xml elements to suppress blank nodes
    var cleanXml = xml.replace(/>(\s+)</g, '><');
    
    // capture the osm xml via DOMParser
    var domParser = new DOMParser();
    this.doc = domParser.parseFromString(cleanXml, "text/xml");
  }
}); // --XmlDoc

/**
 * Provides a simple, DOM independent event system
 * @class 
 * @property {Object} eventHandlers Contains eventNames, each containing an eventHandler arrays  
 **/
var AppEvents = Class.create(
/** @scope AppEvents.prototype */
{
  /**  @constructs */
  initialize: function () {
    this.eventHandlers = {};
  },
  
  /** 
   *  Returns true if the event exists
   *  @param eventName Name of property in {@link AppEvents.eventHandlers}   
   *  @returns {Boolean} True if eventName exists
   */
  exists: function (/**String*/ eventName) {
    return !!this.eventHandlers[eventName]; // force out a boolean
  },
  
  /** Executes every eventhandler for the given eventName
   *  passing in the eventData object to each
   *  @param eventName Name of property in {@link AppEvents.eventHandlers}   
   *  @param eventData Object passed to each eventHandler for eventName  
   */
  fire: function (/**String*/ eventName, /**Object*/ eventData) {
    if (this.exists(eventName)) {
      var theEventData = eventData;
      this.eventHandlers[eventName].each(function (handler) {
        handler(theEventData);
      });
    }
  },
  
  /** Adds eventHandler to the eventName creating eventName if necessary
   *  @param eventName Name of property in {@link AppEvents.eventHandlers}   
   *  @param eventHandler Function to be executed when eventName is 'fired' 
   */
  addEventHandler: function (/**String*/ eventName, /**Function*/ eventHandler) {
    if (!this.exists(eventName)) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(eventHandler);  
  },

  /** Removes eventHandler from eventName
   *  @param eventName Name of property in {@link AppEvents.eventHandlers}   
   *  @param eventHandler Function to be executed when eventName is 'fired' 
   */
  removeEventHandler: function (/**String*/ eventName, /**Function*/ eventHandler) {
    delete this.eventHandlers[eventName];
  }
}); // --AppEvents


/**
 * Supports iteration within all or a section of an array
 * based on user specified startIndex and endIndex where the 
 * startIndex may be greater then the lastIndex, in which case the
 * 'next' function will decrement. Also supports returning 
 * slices of the array based on the currIndex    
 * @class 
 * @property {Array} theArray The Array to be iterated
 * @property {Number} length The length of the array
 * @property {Number} startIndex First index for iteration
 * @property {Number} lastIndex Last index for iteration
 * @property {Number} currIndex Current index of iteration or -1 if invalid
 * @property {Object} currItem Object at the current index or undefined
 * @property {Number} incr Increment value, either +1 or -1
 **/
var ArraySectionIterator = Class.create(
/** @scope ArraySectionIterator.prototype */
{
  /** 
   *  @constructs   
   *  @param theArray The array to be iterated  
   *  @param startIndex The first index for iteration  
   *  @param lastIndex The last index for iteration  
   */
  initialize: function (
      /**Array*/ theArray, 
      /**Number*/ startIndex, 
       /**Number*/ lastIndex) {
    this.theArray = theArray;
    this.length = this.theArray.length;
    this.startIndex = startIndex;
    this.lastIndex = lastIndex;
    this.currIndex = -1; // invalid value
    this.currItem = undefined;
    this.incr = undefined;
    // note: this implies that we do not handle 'empty' sections
    if (this.startIndex <= this.lastIndex) {
      this.incr = 1;
    } else {
      this.incr = -1;
    }
  },
  
  /** 
   *  Returns true if the current index is valid
   *  @returns {Boolean} True currIndex is valid for index range
   */
  isValid: function () {
    var isValid = false;
    // !!! should extend the Number type with 'between' function
    if (this.startIndex < this.lastIndex) {
      if ((this.startIndex <= this.currIndex) && 
                          (this.currIndex <= this.lastIndex)) {
        isValid = true;           
      }
    } else {
      if ((this.startIndex >= this.currIndex) && 
                          (this.currIndex >= this.lastIndex)) {
        isValid = true;           
      }
    }
    return isValid;  
  },
  
  /** 
   *  Returns current item or undefined
   *  @returns {Object} Item returned from current array position or undefined
   */
  current: function () {
    if (this.isValid()) {
      this.currItem = this.theArray[this.currIndex];
    } else {
      this.currItem = undefined;
    }
    return this.currItem;    
  },
  
  /** 
   *  Returns first item in the array
   *  @returns {Object} Make first array position current and return that item
   */
  first: function () {
    this.currIndex = this.startIndex;
    return this.current();    
  },
  
  /** 
   *  Returns next item in the array or undefined
   *  @returns {Object} Make next array position current and return that item 
   *  or else return undefined   
   */
  next: function () {
    this.currItem = undefined;
    if (this.isValid()) {
      this.currIndex = this.currIndex + this.incr;
      if (this.isValid()) {
        this.currItem = this.current();
      }
    }
    return this.currItem;    
  },

  /** 
   *  Returns section of array, between and including beginIndex and endIndex
   *  @param beginIndex First index to use when obtaining array slice  
   *  @param endIndex Second index to use when obtaining array slice  
   *  @returns {Array} Array slice corresponding to indices, inclusive   
   */
  getSlice: function (/** Number */ beginIndex, /** Number */ endIndex) {
    // given inclusive start and end indexes, 
    // return corresponding section of the array
    var theArray = undefined;
    if (beginIndex < endIndex) {
      theArray = this.theArray.slice(beginIndex, endIndex + 1);
    } else if (beginIndex > endIndex) {
      theArray = this.theArray.slice(endIndex, beginIndex + 1);
    }
    return theArray;    
  },

  /** 
   * Returns section of array, from startIndex to currIndex, inclusive 
   * of currIndex, unless excludeFlag is true   
   *  @param excludeFlag If true, include currIndex in array  
   *  @returns {Array} Array slice from startIndex to currIndex   
   */
  getNearSlice: function (/**Boolean*/ excludeFlag) {
    // using currIndex as reference point, return the 'near' part of array
    var incr = 0;
    if (excludeFlag && excludeFlag === true) {
      incr = this.incr;
    }
    var theArray = undefined;
    if (this.isValid()) {
      theArray = this.getSlice(this.startIndex, this.currIndex - incr);
    } else {
      theArray = this.theArray;
    }
    return theArray;    
  },

  /** 
   * Returns section of array, from currIndex to lastIndex, inclusive 
   * of currIndex, unless excludeFlag is true   
   *  @param excludeFlag If true, include currIndex in array  
   *  @returns {Array} Array slice from currIndex to lastIndex  
   */
  getFarSlice: function (/**Boolean*/ excludeFlag) {
    // using currIndex as reference point, return the 'far' part of array
    var incr = 0;
    if (excludeFlag && excludeFlag === true) {
      incr = this.incr;
    }
    var theArray = undefined;
    if (this.isValid()) {
      theArray = this.getSlice(this.currIndex + incr, this.lastIndex);
    } else {
      theArray = this.theArray;
    }
    return theArray;    
  }
}); // --ArraySectionIterator


/**
 * Supports simple forward iteration through and entire array 
 * @class 
 * @extends ArraySectionIterator
 **/
var ArrayIterator = Class.create(ArraySectionIterator, 
/** @scope ArrayIterator.prototype */
{
  /** 
   *  @constructs   
   *  @param $super Reference to constructor for {@link ArraySectionIterator}  
   *  @param theArray The array to be iterated  
   */
  initialize: function (/**Function*/ $super, /**Array*/ theArray) {
    $super(theArray, 0, theArray.length - 1);
  }
}); // --ArrayIterator


