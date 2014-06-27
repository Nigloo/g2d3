!function() {
'use strict';
  
  var lib_name = 'g2d3';
  
  var main_object = {
    version: '0.5'
  };
  window[lib_name] = main_object;
  
  // Some constants
  var data_binding_prefix = 'data:';
  var main_dataset_name = 'default_data';
  var sliderHeight = 50;
  var handleSize = 18;
  
  ///////////////////////
  // Graphic's methods //
  ///////////////////////

  // Create a new graphic
  main_object.graphic = function(args) {
    return new Graphic(args);
  };
  
  // Graphic definition
  function Graphic() {
    this.spacialCoord = null;
    this.spacialDimName = null;
    this.coord();
    this.temporalDim = null;
    this.time();
    this.axisProperty = null;
    this.dataset = {};
    this.dataset[main_dataset_name] = null;
    this.dataLoader = null;
    this.elements = [];
    this.fallback_element = new ElementBase();
    this.lastElementAdded = this.fallback_element;
    
    
    // Both 'boxplot' and 'axis' method need dimensions to be set and
    // therefore have to be called after 'coord' and 'time' method
    this.boxplot_function_called = false;
    this.axis_function_called = false;
    
    
    this.drawBackground = true;
    this.transition_duration = 250;
    this.display_timers = false;
    this.merge_null_axis = true;
    
    this.ordinal_scale_padding = 1;
    this.linear_scale_padding = 0.1;
    this.coordSysMargin = 0.15;
    this.bar_padding = 1;
    
    
    this.render_param = null;
    this.data_view_generator = [];
    
    // Attributes non null only after render
    this.width = null;
    this.height = null;
    this.margin = null;
    this.svg = null;
    this.nestedData = null;
    this.currentTime = null;
    this.splitTempDimId = null;
    this.splitSpacialDimId = null;
    this.dim = null;
    this.timeSlider = null;
    this.nbCalcultedValues = null;
  };
  
  // TODO: remove
  Graphic.prototype.hack = function(param) {
    for(var i in param) {
      this[i] = param[i];
    }
    
    return this;
  };
  
  // Set element properties
  Graphic.prototype.element = function(param) {
    this.fallback_element = new ElementBase();
    this.lastElementAdded = this.fallback_element;
    
    if(isDefined(param)) {
      for(var attr in param) {
        if(isDefined(this.fallback_element.attrs[attr])) {
          this.fallback_element.attrs[attr].value = param[attr];
        }
        else {
          this.fallback_element.attrs[attr] = { type:'unknown',
                                                value:param[attr]};
        }
      }
    }
    
    this.fallback_element.datasetName = checkParam('Graphic.element', param, 'data', main_dataset_name);
    
    return this;
  };
  
  // Add circles
  Graphic.prototype.symbol = function(param) {
    addElement(this, Symbol, param, 'Graphic.symbol');
    
    return this;
  };
  
  // Add lines
  Graphic.prototype.line = function(param) {
    addElement(this, Line, param, 'Graphic.line');
    
    return this;
  };
  
  // Add bars
  Graphic.prototype.bar = function(param) {
    addElement(this, Bar, param, 'Graphic.bar');
    
    return this;
  };
  
  // Add boxplot (without the outliers and without computing any stats)
  Graphic.prototype.boxplotBox = function(param) {
    addElement(this, BoxPlot, param, 'Graphic.boxplot');
    
    return this;
  };
  
  // Add boxplot
  Graphic.prototype.boxplot = function(param) {
    this.boxplot_function_called = true;
    
    var funcName = 'Graphic.boxplot';
    var group_by = {};
    var stat_on = null;
    var stat_on_attr;
    
    
    var attr = {};
    for(var i in this.fallback_element.attrs) {
      if(this.fallback_element.attrs[i].value != null) {
        attr[i] = this.fallback_element.attrs[i].value;
      }
    }
    for(var i in param) {
      attr[i] = param[i];
    }
    
    for(var i in attr) {
      if(attr[i] instanceof BoxPlotStat) {
        stat_on = attr[i].attrs.value;
        stat_on_attr = i;
        delete attr[i];
      }
      else if(this.spacialDimName.indexOf(i) >= 0) {
        group_by[i] = attr[i];
        delete attr[i];
      }
    }
    for(var i in this.temporalDim) {
      group_by[i] = this.temporalDim[i];
    }
    group_by.group = attr.group;
    delete attr.group;
    
    var groupByAes = {};
    var attrAes = {};
        
    // Aesthetics
    var aes = [];
    // Map data column name -> aesthetic id
    var dataCol2Aes = {};
    // Map function -> aesthetic id
    var func2Aes = {};
    // Map const value -> aesthetic id
    var const2Aes = {};
    
    for(var i in group_by) {
      var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, group_by[i], main_dataset_name, 'group_by:'+i, funcName);
      groupByAes[i] = aes[aesId];
    }
    for(var i in attr) {
      var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr[i], main_dataset_name, 'group_by:'+i, funcName);
      attrAes[i] = aes[aesId];
    }
    
    var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, stat_on, main_dataset_name, 'stat_on', funcName);
    var statOnAes = aes[aesId];
    
    var aggregate = function(getDatum) {
      
      // data = {oldData, newData, oldProcessedData}
      return function(data) {
        // We recompute the whole thing
        data = data.oldData.concat(data.newData);
        
        // Sizes of each splits, sub-splits, etc
        var splitSizes = [];
        
        for(var i in group_by) {
          computeDomain(groupByAes[i], data, 'discret');
          splitSizes.push(groupByAes[i].discretDomain.length);
        }
        
        checkAesType('number', typeof statOnAes.func(data[0], 0), 'stat_on', funcName);
        
        var nestedata = allocateSplitDataArray(splitSizes, 0);
        for(var i = 0 ; i < data.length ; i++) {
          var dataSubset = nestedata;
          
          for(var j in group_by) {
            var value = groupByAes[j].func(data[i], i);
            var id = groupByAes[j].discretDomain.indexOf(value);
            dataSubset = dataSubset[id];
          }
          
          dataSubset.push(data[i]);
        }
        
        var new_data = [];
        
        var it = new HierarchyIterator(nestedata);
        while(it.hasNext()) {
          var dataSubset = it.next();
          if(dataSubset.length <= 0) {
            continue;
          }
          
          var valuesIndex = [];
          for(var i = 0 ; i < dataSubset.length ; i++) {
            valuesIndex.push({value:statOnAes.func(dataSubset[i], i), index:i});
          }
          valuesIndex.sort(function(a, b){return a.value-b.value});
          
          var values = [];
          var sortedDataSubset = [];
          for(var i = 0 ; i < valuesIndex.length ; i++) {
            values[i] = valuesIndex[i].value;
            sortedDataSubset[i] = dataSubset[valuesIndex[i].index];
          }
          
          new_data = new_data.concat(getDatum(sortedDataSubset, values));
        }
        
        return {oldData:[], newData:new_data};
      };
    };
    
    var computeStat = function(dataSubset, values) {
      var new_datum = {};
      for(attr in dataSubset[0]) {
        new_datum[attr] = dataSubset[0][attr];
      }
      
      new_datum.quartile1 = d3.quantile(values, 0.25);
      new_datum.quartile2 = d3.quantile(values, 0.50);
      new_datum.quartile3 = d3.quantile(values, 0.75);
      
      var IQR = new_datum.quartile3 - new_datum.quartile1;
      var min = values[0];
      var max = values[values.length-1];
      new_datum.whisker1 = Math.max(new_datum.quartile1 - 1.5*IQR, min);
      new_datum.whisker2 = Math.min(new_datum.quartile3 + 1.5*IQR, max);
      
      return [new_datum];
    };
    
    var computeOutliers = function(dataSubset, values) {
      var new_data = [];
      var quartile1 = d3.quantile(values, 0.25);
      var quartile3 = d3.quantile(values, 0.75);
      
      var IQR = quartile3 - quartile1;
      var min = values[0];
      var max = values[values.length-1];
      var whisker1 = Math.max(quartile1 - 1.5*IQR, min);
      var whisker2 = Math.min(quartile3 + 1.5*IQR, max);
      
      // We can loop like this because values are sorted
      for(var i = 0 ; values[i] < whisker1 ; i++) {
        new_data.push(dataSubset[i]);
      }
      for(var i = dataSubset.length -1 ; values[i] > whisker2 ; i--) {
        new_data.push(dataSubset[i]);
      }
      
      return new_data;
    };
    
    var temporalDim = this.temporalDim;
    var getId = function(d) {
      var id = '';
      for(var i in groupByAes) {
        if(!(i in temporalDim)) {
          id += groupByAes[i].func(d, 0) + '-';
        }
      }
      return id;
    };
    
    var name = 'boxplot';
    
    if((name+'.statistic') in this.dataset ||
       (name+'.outlier') in this.dataset)
    {
      var i = 2;
      while((name+i+'.statistic') in this.dataset ||
            (name+i+'.outlier') in this.dataset) {
        i++;
      }
      name = name+i;
    }
    
    this.dataView({name:name+'.statistic', func:aggregate(computeStat)});
    this.dataView({name:name+'.outlier',  func:aggregate(computeOutliers)});
    
    var funcParamStat = {};
    var funcParamOutliers = {};
    for(i in param) {
      funcParamStat[i] = param[i];
      funcParamOutliers[i] = param[i];
    }
    
    funcParamStat.data = name+'.statistic';
    funcParamStat[stat_on_attr] = main_object.boxplotBoxStat();
    this.boxplotBox(funcParamStat);
    
    funcParamOutliers.data = name+'.outlier';
    funcParamOutliers[stat_on_attr] = stat_on;
    funcParamOutliers.group = getId;
    funcParamOutliers.label = stat_on;
    this.symbol(funcParamOutliers);
    
    return this;
  }
  
  // Add listener
  Graphic.prototype.on = function(param) {
    var funcName = 'Graphic.on';
    var event =     checkParam(funcName, param, 'event');
    var listener =  checkParam(funcName, param, 'listener');
    
    this.lastElementAdded.listeners[event] = listener;
    
    return this;
  };
  
  // Set dataset
  Graphic.prototype.data = function(param) {
    var funcName = 'Graphic.data';
    var data = checkParam(funcName, param, 'data');
    if(data instanceof Array) {
      this.onDataLoaded(data);
    }
    else if(data instanceof DataLoader) {
      this.dataLoader = data;
      this.dataLoader.g = this;
    }
    else {
      ERROR(errorParamMessage('Graphic.data', 'data', 'null',
        'Array  or value returned by '+lib_name+'.loadFromFile or '+lib_name+'.loadFromDatabase'));
    }
    
    return this;
  };
  
  // Push data
  Graphic.prototype.pushData = function(data) {
    
    for(var datasetName in this.dataset) {
      this.dataset[datasetName] = {oldData:this.dataset[datasetName],
                                   newData:[]};
    }
    this.dataset[main_dataset_name].newData = data;
    
    updateDataViews.call(this);
    
    updateScales.call(this);
    
    mergeOldAndNewData.call(this);
    
    TIMER_GROUP_BEGIN('Updating SVG', this.display_timers);
    
    TIMER_BEGIN('Updating background and axises', this.display_timers);
    var svg = this.svg.select('.depth0');
    this.spacialCoord.updateSVG(svg, this.dim, this.width, this.height, 0);
    TIMER_END('Updating background and axises', this.display_timers);
    
    TIMER_BEGIN('Updating sliders', this.display_timers);
    this.updateSliders();
    TIMER_END('UpdatingUpdating sliders', this.display_timers);
    
    TIMER_BEGIN('Updating elements', this.display_timers);
    this.updateElements();
    TIMER_END('Updating elements', this.display_timers);
    
    TIMER_GROUP_END('Updating SVG', this.display_timers);
    
    return this;
  };
  
  // A new data set generated from the main dataset
  Graphic.prototype.dataView = function(param) {
    var funcName = 'Graphic.dataView';
    var name = checkParam(funcName, param, 'name');
    var func = checkParam(funcName, param, 'func');
    
    this.data_view_generator.push({name:name, func:func});
    
    return this;
  };
  
  // Set data just loaded, filter them and render if needed;
  // Not supposed to be called by the user
  Graphic.prototype.onDataLoaded = function(data) {
    this.dataset[main_dataset_name] = {oldData:[], newData:data};
    
    if(this.render_param != null) {
      var param = this.render_param;
      this.render_param = null;
      this.render(param);
    }
  };
  
  // Set spacial coordinate system (Rect({x:'x', y:'y'}) by default)
  Graphic.prototype.coord = function(coordSys) {
    if(this.boxplot_function_called) {
      ERROR('impossible to call Graphic.coord after Graphic.boxplot');
    }
    if(this.axis_function_called) {
      ERROR('impossible to call Graphic.coord after Graphic.axis');
    }
    
    if(isUndefined(coordSys)) {
      // Default coordinate system
      this.coord(new Rect());
    }
    else {
      this.spacialCoord = coordSys;
      var coordSyss = [];
      coordSys.supSys = null;
      
      while(coordSys != null) {
        coordSyss.push(coordSys);
        coordSys.g = this;
        // Double chaining between coordinate systems
        if(coordSys.subSys != null) {
          coordSys.subSys.supSys = coordSys;
        }
        
        if(coordSys instanceof Polar && coordSys.subSys != null) {
          ERROR('Impossible to have a sub coordinate system in a Polar system');
        }
        else{
          coordSys = coordSys.subSys;
        }
      }
      
      // Set default names
      this.spacialDimName = [];
      
      var generateName = function(nameBase) {
        if(this.spacialDimName.indexOf(nameBase) == -1) {
          return nameBase;
        }
        else {
          var i = 1;
          while(this.spacialDimName.indexOf(nameBase+i) >= 0) {
            i++;
          }
          
          return nameBase+i;
        }
      }
      
      for(var i = coordSyss.length - 1 ; i >= 0 ; i--) {
        for(var j in coordSyss[i].dimAlias) {
          if(coordSyss[i].dimAlias[j] === undefined) {
            coordSyss[i].dimAlias[j] = generateName.call(this, j);
          }
          if(coordSyss[i].dimAlias[j] != null) {
            this.spacialDimName.push(coordSyss[i].dimAlias[j]);
          }
        }
      }
    }
    
    return this;
  };
  
  // Set temporal coordinate system (none by default)
  Graphic.prototype.time = function(param) {
    if(this.boxplot_function_called) {
      ERROR('impossible to call Graphic.time after Graphic.boxplot');
    }
    if(this.axis_function_called) {
      ERROR('impossible to call Graphic.time after Graphic.axis');
    }
    
    if(isUndefined(param)) {
      this.temporalDim = {};
    }
    else {
      this.temporalDim = param;
    }
    
    return this;
  };
  
  // Change axis properties
  Graphic.prototype.axis = function(param) {
    if(this.axisProperty == null) {
      this.axisProperty = {};
      if(isDefined(param)) {
        this.axis();
      }
    }
    
    this.axis_function_called = true;
    var funcName = 'Graphic.axis';
    var dimAlias =      checkParam(funcName, param, 'axis',     null);
    var display =       checkParam(funcName, param, 'display',  true);
    var displayAxis =   checkParam(funcName, param, 'display_axis',  display);
    var displayTicks =  checkParam(funcName, param, 'display_ticks',  display);
    
    if(dimAlias === null) {
      dimAlias = [];
      for(var i = 0 ; i < this.spacialDimName.length ; i++) {
        dimAlias.push(this.spacialDimName[i]);
      }
      for(var i in this.temporalDim) {
        dimAlias.push(i);
      }
    }
    else {
      dimAlias = [dimAlias];
    }
    
    for(var i = 0 ; i < dimAlias.length ; i++) {
      var axProp = this.axisProperty[dimAlias[i]] = {};
      axProp.displayAxis = displayAxis;
      axProp.displayTicks = displayTicks;
    }
    
    return this;
  }
  
  // Go to the specified value of the specified time dimension
  Graphic.prototype.setTimeValue = function(timeDimension, value) {
    if(isUndefined(timeDimension) ||
       isUndefined(value) ||
       this.currentTime == null) {
      return this;
    }
    
    var index = this.dim[timeDimension].domain.indexOf(value);
    if(index >= 0 && this.currentTime[timeDimension] != index) {
      this.currentTime[timeDimension] = index;
      this.updateElements();
      this.updateSliders();
      removePopups(this);
    }
    
    return this;
  }
  
  // Go to the next value of the specified time dimension
  Graphic.prototype.nextStep = function(timeDimension) {
    if(isUndefined(timeDimension) || this.currentTime == null) {
      return this;
    }
    
    if(this.currentTime[timeDimension] < this.dim[timeDimension].domain.length-1){
      this.currentTime[timeDimension]++;
      this.updateElements();
      this.updateSliders();
      removePopups(this);
    }
    
    return this;
  };
  
  // Go to the previous value of the specified time dimension
  Graphic.prototype.previousStep = function(timeDimension) {
    if(isUndefined(timeDimension) || this.currentTime == null) {
      return this;
    }
    
    if(this.currentTime[timeDimension] > 0){
      this.currentTime[timeDimension]--;
      this.updateElements();
      this.updateSliders();
      removePopups(this);
    }
    
    return this;
  };

  // Render the graphic in svg
  Graphic.prototype.render = function(param) {
    // Check parameters
    var funcName = 'Graphic.render';
    var selector =  checkParam(funcName, param, 'selector', 'body');
    this.width =    checkParam(funcName, param, 'width',    640);
    this.height =   checkParam(funcName, param, 'height',   360);
    this.margin = { left:   checkParam(funcName, param, 'margin', 30),
                    top:    checkParam(funcName, param, 'margin', 10),
                    right:  checkParam(funcName, param, 'margin', 10),
                    bottom: checkParam(funcName, param, 'margin', 20)};
    this.margin.left =    checkParam(funcName, param, 'margin_left',    this.margin.left);
    this.margin.top =     checkParam(funcName, param, 'margin_top',     this.margin.top);
    this.margin.right =   checkParam(funcName, param, 'margin_right',   this.margin.right);
    this.margin.bottom =  checkParam(funcName, param, 'margin_bottom',  this.margin.bottom);
    
    if(this.elements.length == 0) {
      ERROR('no element in the graphic');
    }
    
    // Reserve some space for the graphic while loading
    // Add Canvas
    if(this.svg == null) {
      this.svg = d3.select(selector)
                   .append("svg")
                   .attr("width", this.width)
                   .attr("height", this.height);
                   
      if(this.svg.empty()) {
        ERROR('can\'t find '+selector);
      }
    }
    
    
    /*           *\
     * Load data *
    \*           */
    if(!loadData.call(this, param)) {
      return this;
    }
    
    LOG("Ready to plot: selector={0}, width={1}, height={2}".format(
          selector,
          this.width,
          this.height));
    LOG("Margin: left={0}, right={1}, top={2}, bottom={3}".format(
          this.margin.left,
          this.margin.right,
          this.margin.top,
          this.margin.bottom));
    
    this.width -=  (this.margin.left + this.margin.right);
    this.height -= (this.margin.top + this.margin.bottom);
    
    
    // Information on each dimension
    if(this.axisProperty == null) {
      this.axis();
    }
    this.dim = getDimensionsInfo( this.spacialCoord,
                                  this.temporalDim,
                                  this.axisProperty);
                                  
    // Reserve some space for sliders
    
    var nbSlider = 0;
    for(var i in this.dim) {
      if(!this.dim[i].isSpacial) {
        nbSlider++;
      }
    }
    this.height -= sliderHeight * nbSlider;
    
    
    /*                                                *\
     * Generation of data views (per element dataset) *
    \*                                                */
    updateDataViews.call(this);
    
    
    /*                                                   *\
     * Merge old data (none) with new data (just loaded) *
    \*                                                   */
    mergeOldAndNewData.call(this);
    //console.log(this.dataset[main_dataset_name]);
    //return this;
    /*                                         *\
     * Standardization of elements' attributes *
    \*                                         */
    elementsStandardization.call(this);
    
    /*                 *\
     * Compute scales  *
    \*                 */
    computeScales.call(this);
    
    
    /*                *\
     * Generating svg *
    \*                */
    generateSVG.call(this);
    
    return this;
  };
  
  // (Re)draw elements of the graphics
  Graphic.prototype.updateElements = function() {
    /*                   *\
     * Utility functions *
    \*                   */
    
    var getMin = function(f1, f2) {
      return function(d, i){
        return Math.min(f1(d, i), f2(d, i));
      }
    }
    
    var getMax = function(f1, f2) {
      return function(d, i){
        return Math.max(f1(d, i), f2(d, i));
      }
    }
    
    var getDist = function(f1, f2) {
      return function(d, i){
        return Math.abs(f1(d, i) - f2(d, i));
      }
    }
    
    var getConst = function(c) {
      return function() {
        return c;
      };
    };
    
    
    // Deepest coordinate system and iterator state to go through data
    var maxPos = [];
    var nonNullDim = [];
    var deepestCoordSys = this.spacialCoord;
    var i = 0;
    while(deepestCoordSys.subSys != null) {
      maxPos[i] = [];
      nonNullDim[i] = [];
      
      for(var j = 0 ; j < deepestCoordSys.dimName.length ; j++) {
        var dimAlias = deepestCoordSys.dimAlias[deepestCoordSys.dimName[j]];
        if(dimAlias != null) {
          maxPos[i][j] = this.dim[dimAlias].domain.length;
          nonNullDim[i][j] = true;
        }
        else {
          maxPos[i][j] = 1;
          nonNullDim[i][j] = false;
        }
      }
      deepestCoordSys = deepestCoordSys.subSys;
      i++;
    }
    
    // Deepest coordinate system dimention
    var deepestCoordSysDim = [];
    for(var i in deepestCoordSys.dimAlias) {
      deepestCoordSysDim.push({ name:deepestCoordSys.dimAlias[i],
                                originalName:i});
    }
    
    
    // Draw elements
    for(var i = 0 ; i < this.elements.length ; i++) {
      /*                                     *\
       * Compute 'getX' and 'getY' functions *
      \*                                     */
      
      var getGetPos = function (cs, f, p) {
        return function (d, i) {
          return cs[f](p, d, i);
        }
      };
      
      var pos = [];
      
      for(var j in this.dim) {
        if(this.dim[j].isSpacial) {
          if(!(this.elements[i].attrs[j].value instanceof Interval) &&
             !(this.elements[i].attrs[j].value instanceof BoxPlotBoxStat)) {
            pos[j] = this.elements[i].attrs[j].aes.func;
          }
          else {
            pos[j] = null;
          }
        }
      }
      
      var getX = null;
      var getY = null;
      
      if(this.elements[i] instanceof Bar ||
         this.elements[i] instanceof BoxPlot) {
        getX = getGetPos(deepestCoordSys, 'getXOrigin', pos);
        getY = getGetPos(deepestCoordSys, 'getYOrigin', pos);
      }
      else {
        getX = getGetPos(deepestCoordSys, 'getX', pos);
        getY = getGetPos(deepestCoordSys, 'getY', pos);
      }
      
      /*               *\
       * Draw elements *
      \*               */
      
      // Data belonging to the current time
      var dataToDisplay = this.nestedData[i];
      for(var j in this.currentTime) {
        dataToDisplay = dataToDisplay[this.currentTime[j]];
      }
      
      
      var currentPos = [];
      var subset = [dataToDisplay];
      var svgGroups = [this.svg.select('.depth0')];
      
      for(var j = 0 ; j < maxPos.length ; j++) {
        currentPos[j] = [];
        var idGroup = '';
        for(var k = 0 ; k < maxPos[j].length ; k++) {
          currentPos[j][k] = 0;
          if(nonNullDim[j][k]) {
            subset.push(subset[subset.length-1][0]);
          }
          idGroup += k ? '-0' : '.sub-graphic-0';
        }
        svgGroups.push(svgGroups[svgGroups.length-1].select(idGroup));
      }
      
      var nbGroup = this.elements[i].attrs.group.aes.discretDomain.length;
      
      // HERE WE DRAW !!
      var stop = false;
      while(!stop) {
        var dataCurrentPos = subset[subset.length-1];
        var svg = svgGroups[svgGroups.length-1];
        
        for(var groupId = 0 ; groupId < nbGroup ; groupId++) {
          var dataSubset = dataCurrentPos[groupId];
          var eltClass = 'etl-'+i+'-'+groupId;
          
          var getOnMouseOver = function(g, eltClass, getText) {
            return function(d, i) {
              var eltId = eltClass+'-'+i;
              var timeId = getTimeId(g.currentTime);
              var pos = main_object.mouse(g);
              
              if(!main_object.popupExist({id:['bound-to-time', eltId, timeId], graphic:g})) {
                  main_object.showPopup({id:'hover', graphic:g, position:pos, text:getText(d)});
              }
            };
          };
          
          var getOnMouseOut = function(g) {
            return function(d, i) {
              main_object.hidePopup({id:'hover', graphic:g, duration:500});
            };
          };
          
          var getOnClick = function(g, eltClass, getText) {
            return function(d, i) {
              var eltId = eltClass+'-'+i;
              var timeId = getTimeId(g.currentTime);
              
              if(main_object.popupExist({id:['bound-to-time', eltId, timeId], graphic:g})) {
                main_object.hidePopup({id:['bound-to-time', eltId, timeId], graphic:g});
              }
              else {
                main_object.showPopup({id:['bound-to-time', eltId, timeId], graphic:g, position:main_object.mouse(g), text:getText(d)});
                main_object.hidePopup({id:'hover', graphic:g});
              }
            };
          };
          
          // Set attributes for each kind of elements
          // Symbol
          if(this.elements[i] instanceof Symbol) {
            var symbol = d3.svg.symbol();
            
            if(isDefined(this.elements[i].attrs.shape))
              symbol.type(this.elements[i].attrs.shape.func);
              
            if(isDefined(this.elements[i].attrs.size))
              symbol.size(this.elements[i].attrs.size.func);
            
            var node = svg.selectAll('.'+eltClass)
                          .data(dataSubset);
            
            // On enter
            var onEnter = node.enter().append('path').attr('class', eltClass);
            svgSetAttributePerElem(onEnter, 'fill', this.elements[i], 'color');
            svgSetCommonAttributesPerElem(onEnter, this.elements[i]);
            onEnter.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
            onEnter.attr('d', symbol);
            
            // On exit
            node.exit().remove();
            
            // On update
            var onUpdate = null;
            if(this.transition_duration > 0) {
              onUpdate = node.transition().duration(this.transition_duration);
            }
            else {
              onUpdate = node;
            }
            svgSetAttributePerElem(onUpdate, 'fill', this.elements[i], 'color');
            svgSetCommonAttributesPerElem(onUpdate, this.elements[i]);
            onUpdate.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
            node.attr('d', symbol);
            
            // Event
            if(isDefined(this.elements[i].attrs.label)){
              node.on('mouseover',  getOnMouseOver(this, eltClass, this.elements[i].attrs.label.func));
              node.on('mouseout',   getOnMouseOut(this));
              node.on('click',      getOnClick(this, eltClass, this.elements[i].attrs.label.func));
            }
            var listeners = this.elements[i].listeners;
            var GetFunc = function(event) {
              return function(d) {
                listeners[event].call(this, d, g);
              }
            }
            
            for(var event in listeners) {
              node.on(event, GetFunc(event));
            }
          }
          
          // Lines
          else if(this.elements[i] instanceof Line) {
            if(dataSubset.length > 0) {
              var interpolation = this.elements[i].attrs.interpolation.func(dataSubset[0], 0);
              
              var lineFunction = d3.svg.line()
                                   .x(getX)
                                   .y(getY)
                                   .interpolate(interpolation);
              
              var node;
              // On enter
              if(svg.select('.'+eltClass).empty()) {
                node = svg.append('path').attr('class', eltClass);
              }
              // On update
              else {
                node = svg.select('.'+eltClass);
                if(this.transition_duration > 0) {
                  node = node.transition().duration(this.transition_duration);
                }
              }
              
              node.attr("d", lineFunction(dataSubset));
              
              if(dataSubset.length > 0) {
                svgSetAttributePerGroup(node, 'stroke', this.elements[i], 'color', dataSubset[0], 0);
                svgSetCommonAttributesPerGroup(node, this.elements[i], dataSubset[0], 0);
                svgSetAttributePerGroup(node, 'stroke-linecap', this.elements[i], 'stroke_linecap', dataSubset[0], 0);
              }
            }
            else {
              // On exit
              svg.select('.'+eltClass).remove();
            }
          }
          
          // Bars
          else if(this.elements[i] instanceof Bar) {
            var boundaryFunc = {};
            var padding = this.bar_padding;
            
            for(var j = 0 ; j < deepestCoordSysDim.length ; j++) {
              var dimAlias = deepestCoordSysDim[j].name;
              var originalDimName = deepestCoordSysDim[j].originalName;
              
              boundaryFunc[originalDimName]  = {  min:null,
                                                  max:null,
                                                  dist:null};
              
              if(dimAlias == null) {
                var min = deepestCoordSys.boundary[originalDimName].min;
                var max = deepestCoordSys.boundary[originalDimName].max;
                var dist = (max - min) / (1 + padding);
                
                boundaryFunc[originalDimName].min = getConst((min + max - dist)/2);
                boundaryFunc[originalDimName].max = getConst((min + max + dist)/2);
                boundaryFunc[originalDimName].dist = getConst(dist);
              }
              else {
                var scale = deepestCoordSys.scale[originalDimName];
                
                var bound1 = null;
                var bound2 = null;
                
                if(this.elements[i].attrs[dimAlias].value instanceof Interval) {
                  var interval = this.elements[i].attrs[dimAlias].value;
                  
                  bound1 = scale.compose(interval.attrs.boundary1.func),
                  bound2 = scale.compose(interval.attrs.boundary2.func);
                }
                else {
                  var band = this.dim[dimAlias].band / (1 + padding);
                  var func = this.elements[i].attrs[dimAlias].aes.func;
                  
                  var getFunc = function(s, f, e) {
                    return function(d, i){
                      return s(f(d, i)) + e;
                    }
                  }
                  
                  bound1 = getFunc(scale, func, -band / 2);
                  bound2 = getFunc(scale, func, band / 2);
                }
                
                boundaryFunc[originalDimName].min = getMin(bound1, bound2);
                boundaryFunc[originalDimName].max = getMax(bound1, bound2);
                boundaryFunc[originalDimName].dist = getDist(bound1, bound2);
              }
            }
            
            var node = svg.selectAll('.'+eltClass)
                          .data(dataSubset);
            
            var dim1 = null;
            var dim2 = null;
            var lim = null;
            
            if(deepestCoordSys instanceof Rect) {
              dim1 = 'x';
              dim2 = 'y';
              lim = 'dist';
            }
            else if(deepestCoordSys instanceof Polar) {
              dim1 = 'theta';
              dim2 = 'radius';
              lim = 'max';
            }
            else {
              ERROR('Bar not implemented for '+getTypeName(deepestCoordSys)+' coordinate system');
            }
            
            node = drawBox( node,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass,
                            getX,
                            getY,
                            boundaryFunc[dim1].min,
                            boundaryFunc[dim2].min,
                            boundaryFunc[dim1][lim],
                            boundaryFunc[dim2][lim]);
            
            // On enter
            svgSetAttributePerElem(node.enter, 'fill', this.elements[i], 'color');
            svgSetAttributePerElem(node.enter, 'stroke', this.elements[i], 'color');
            svgSetCommonAttributesPerElem(node.enter, this.elements[i]);
            
            // On update
            svgSetAttributePerElem(node.update, 'fill', this.elements[i], 'color');
            svgSetAttributePerElem(node.update, 'stroke', this.elements[i], 'color');
            svgSetCommonAttributesPerElem(node.update, this.elements[i]);
            
            // On exit
            node.exit.remove();
            
            // Event
            if(isDefined(this.elements[i].attrs.label)){
              node.enter.on('mouseover',  getOnMouseOver(this, eltClass, this.elements[i].attrs.label.func));
              node.enter.on('mouseout',   getOnMouseOut(this));
              node.enter.on('click',      getOnClick(this, eltClass, this.elements[i].attrs.label.func));
            }
            var listeners = this.elements[i].listeners;
            var GetFunc = function(event) {
              return function(d) {
                listeners[event].call(this, d, g);
              }
            }
            
            for(var event in listeners) {
              node.enter.on(event, GetFunc(event));
            }
          }
        
          // BoxPlot
          else if(this.elements[i] instanceof BoxPlot) {
            var whiskers_size = 0.5;
            var whiskers_ratio = (1 - whiskers_size) / 2;
            
            var posFunc = {};
            var boxplotStat = null;
            
            for(var j = 0 ; j < deepestCoordSysDim.length ; j++) {
              var dimAlias = deepestCoordSysDim[j].name;
              var originalDimName = deepestCoordSysDim[j].originalName;
              
              // Pos
              posFunc[originalDimName] = {// The box
                                          box:{},
                                          // Median Line
                                          median:{},
                                          // First quartile line
                                          q1:{},
                                          // Third quartile line
                                          q3:{},
                                          // Line between the first quartile and the first whisker (min)
                                          w1:{},
                                          // Line between the third quartile and the second whisker (max)
                                          w2:{},
                                          // Line at the first whisker
                                          wl1:{},
                                          // Line at the second whisker
                                          wl2:{}};
                                          
              var p = posFunc[originalDimName];
              
              if(dimAlias == null || !(this.elements[i].attrs[dimAlias].value instanceof BoxPlotBoxStat)) {
                if(dimAlias == null) {
                  var minBox = deepestCoordSys.boundary[originalDimName].min;
                  var maxBox = deepestCoordSys.boundary[originalDimName].max;
                  var distBox = maxBox - minBox;
                  minBox += distBox / 4;
                  maxBox -= distBox / 4;
                  distBox = maxBox - minBox;
                  var minWhiskers = minBox + distBox * whiskers_ratio;
                  var maxWhiskers = maxBox - distBox * whiskers_ratio;
                  var distWhiskers = distBox * whiskers_size;
                  var middle = (minBox + maxBox) / 2;      
                  
                  p.box.min = getConst(minBox);
                  p.box.max = getConst(maxBox);
                  p.box.dist = getConst(distBox);
                  p.wl1.min = getConst(minWhiskers);
                  p.wl1.max = getConst(maxWhiskers);
                  p.wl1.dist = getConst(distWhiskers);
                  p.w1.min = getConst(middle);
                }
                else {
                  var scale = deepestCoordSys.scale[originalDimName];
                  
                  var band = this.dim[dimAlias].band / (1 + this.bar_padding);
                  var func = this.elements[i].attrs[dimAlias].aes.func;
                  
                  var getFunc = function(s, f, e) {
                    return function(d, i){
                      return s(f(d, i)) + e;
                    }
                  }
                  
                  var bound1 = getFunc(scale, func, -band / 2);
                  var bound2 = getFunc(scale, func, band / 2);
                  
                  p.box.min = getMin(bound1, bound2);
                  p.box.max = getMax(bound1, bound2);
                  p.box.dist = getDist(bound1, bound2);
                  
                  // Min whiskers
                  var getFunc = function(b1, b2) {
                    return function(d, i){
                      var val1 = b1(d, i);
                      var val2 = b2(d, i);
                      
                      return val1 > val2 ?
                        val2 + (val1 - val2) * whiskers_ratio :
                        val1 + (val2 - val1) * whiskers_ratio;
                    }
                  }
                  p.wl1.min = getFunc(bound1, bound2);
                  
                  // Max whiskers
                  getFunc = function(b1, b2) {
                    return function(d, i){
                      var val1 = b1(d, i);
                      var val2 = b2(d, i);
                      
                      return val1 > val2 ?
                        val1 - (val1 - val2) * whiskers_ratio :
                        val2 - (val2 - val1) * whiskers_ratio;
                    }
                  }
                  p.wl1.max = getFunc(bound1, bound2);
                  
                  // Distance whiskers (size)
                  getFunc = function(b1, b2) {
                    return function(d, i){
                      return Math.abs(b1(d, i) - b2(d, i)) * whiskers_size;
                    }
                  }
                  p.wl1.dist = getFunc(bound1, bound2);
                  
                  // Middle
                  getFunc = function(b1, b2) {
                    return function(d, i){
                      return (b1(d, i) + b2(d, i)) / 2;
                    }
                  }
                  p.w1.min = getFunc(bound1, bound2);
                }
                
                p.median = p.box;
                p.q1 = p.box;
                p.q3 = p.box;
                p.w1.max = p.w1.min;
                p.w1.dist = getConst(0);
                p.w2 = p.w1;
                p.wl2 = p.wl1;
              }
              else {
                var scale = deepestCoordSys.scale[originalDimName];
                boxplotStat = this.elements[i].attrs[dimAlias].value.attrs;
                
                var q1 = scale.compose(boxplotStat.quartile1.aes.func);
                var q2 = scale.compose(boxplotStat.quartile2.aes.func);
                var q3 = scale.compose(boxplotStat.quartile3.aes.func);
                var w1 = scale.compose(boxplotStat.whisker1.aes.func);
                var w2 = scale.compose(boxplotStat.whisker2.aes.func);
                
                p.wl1.min = w1;
                p.wl1.max = w1;
                p.wl1.dist = getConst(0);
                p.w1.min = getMin(w1, q1);
                p.w1.max = getMax(w1, q1);
                p.w1.dist = getDist(w1, q1);
                p.box.min = getMin(q1, q3);
                p.box.max = getMax(q1, q3);
                p.box.dist = getDist(q1, q3);
                p.q1.min = q1;
                p.q1.max = q1;
                p.q1.dist = getConst(0);
                p.median.min = q2;
                p.median.max = q2;
                p.median.dist = getConst(0);
                p.q3.min = q3;
                p.q3.max = q3;
                p.q3.dist = getConst(0);
                p.w2.min = getMin(q3, w2);
                p.w2.max = getMax(q3, w2);
                p.w2.dist = getDist(q3, w2);
                p.wl2.min = w2;
                p.wl2.max = w2;
                p.wl2.dist = getConst(0);
              }
            }
            
            var dim1 = null;
            var dim2 = null;
            var boxLim = null;
            
            if(deepestCoordSys instanceof Rect) {
              dim1 = 'x';
              dim2 = 'y';
              boxLim = 'dist';
            }
            else if(deepestCoordSys instanceof Polar) {
              dim1 = 'theta';
              dim2 = 'radius';
              boxLim = 'max';
            }
            else {
              ERROR('BoxPlot not implemented for '+getTypeName(deepestCoordSys)+' coordinate system');
            }
            
            var whiskers_dasharray = '5 5'
            var applyToString = function(f) {
              return function(d, i) {
                return f(d, i).toString();
              }
            }
            
            if(isUndefined(this.elements[i].attrs.stroke) &&
               isDefined(this.elements[i].attrs.color)) {
              this.elements[i].attrs.stroke = this.elements[i].attrs.color;
            }
            
            // The box
            var nodeBox = svg.selectAll('.'+eltClass+'.box')
                             .data(dataSubset);
            nodeBox = drawBox( nodeBox,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' box',
                            getX,
                            getY,
                            posFunc[dim1].box.min,
                            posFunc[dim2].box.min,
                            posFunc[dim1].box[boxLim],
                            posFunc[dim2].box[boxLim]);
            svgSetCommonAttributesPerElem(nodeBox.enter, this.elements[i]);
            svgSetCommonAttributesPerElem(nodeBox.update, this.elements[i]);
            nodeBox.exit.remove();
            
            // Event
            var nodeQ1 = svg.selectAll('.'+eltClass+'.quartile1-mask')
                            .data(dataSubset);
            nodeQ1 = drawSegment( nodeQ1,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' quartile1-mask',
                            getX,
                            getY,
                            posFunc[dim1].q1.min,
                            posFunc[dim2].q1.min,
                            posFunc[dim1].q1.max,
                            posFunc[dim2].q1.max);
            nodeQ1.enter.style('fill', 'none');
            nodeQ1.enter.style('stroke-width', 5);
            nodeQ1.enter.style('stroke', 'red');
            nodeQ1.enter.style('visibility', 'hidden');
            nodeQ1.enter.style('pointer-events', 'all');
            nodeQ1.enter.on('mouseover',  getOnMouseOver(this, eltClass+'q1', applyToString(boxplotStat.quartile1.aes.func)));
            nodeQ1.enter.on('mouseout',   getOnMouseOut(this));
            nodeQ1.enter.on('click',      getOnClick(this, eltClass+'q1', applyToString(boxplotStat.quartile1.aes.func)));
            nodeQ1.exit.remove();
            
            var nodeQ3 = svg.selectAll('.'+eltClass+'.quartile3-mask')
                            .data(dataSubset);
            nodeQ3 = drawSegment( nodeQ3,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' quartile3-mask',
                            getX,
                            getY,
                            posFunc[dim1].q3.min,
                            posFunc[dim2].q3.min,
                            posFunc[dim1].q3.max,
                            posFunc[dim2].q3.max);
            nodeQ3.enter.style('fill', 'none');
            nodeQ3.enter.style('stroke-width', 5);
            nodeQ3.enter.style('stroke', 'red');
            nodeQ3.enter.style('visibility', 'hidden');
            nodeQ3.enter.style('pointer-events', 'all');
            nodeQ3.enter.on('mouseover',  getOnMouseOver(this, eltClass+'q3', applyToString(boxplotStat.quartile3.aes.func)));
            nodeQ3.enter.on('mouseout',   getOnMouseOut(this));
            nodeQ3.enter.on('click',      getOnClick(this, eltClass+'q3', applyToString(boxplotStat.quartile3.aes.func)));
            nodeQ3.exit.remove();
            
            // Median
            var nodeMedian = svg.selectAll('.'+eltClass+'.median')
                                .data(dataSubset);
            nodeMedian = drawSegment( nodeMedian,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' median',
                            getX,
                            getY,
                            posFunc[dim1].median.min,
                            posFunc[dim2].median.min,
                            posFunc[dim1].median.max,
                            posFunc[dim2].median.max);
            svgSetCommonAttributesPerElem(nodeMedian.enter, this.elements[i]);
            nodeMedian.enter.style('fill', 'none');
            svgSetCommonAttributesPerElem(nodeMedian.update, this.elements[i]);
            nodeMedian.update.style('fill', 'none');
            nodeMedian.exit.remove();
            
            // Event
            var nodeMedianMask = svg.selectAll('.'+eltClass+'.median-mask')
                                .data(dataSubset);
            nodeMedianMask = drawSegment( nodeMedianMask,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' median-mask',
                            getX,
                            getY,
                            posFunc[dim1].median.min,
                            posFunc[dim2].median.min,
                            posFunc[dim1].median.max,
                            posFunc[dim2].median.max);
            nodeMedianMask.enter.style('stroke-width', 5);
            nodeMedianMask.enter.style('stroke', 'red');
            nodeMedianMask.enter.style('visibility', 'hidden');
            nodeMedianMask.enter.style('pointer-events', 'all');
            nodeMedianMask.enter.on('mouseover',  getOnMouseOver(this, eltClass+'median', applyToString(boxplotStat.quartile2.aes.func)));
            nodeMedianMask.enter.on('mouseout',   getOnMouseOut(this));
            nodeMedianMask.enter.on('click',      getOnClick(this, eltClass+'median', applyToString(boxplotStat.quartile2.aes.func)));
            nodeMedianMask.exit.remove();
            
            
            // First whisker
            var nodeWisker1 = svg.selectAll('.'+eltClass+'.whisker.min')
                                .data(dataSubset);
            nodeWisker1 = drawSegment( nodeWisker1,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' whisker min',
                            getX,
                            getY,
                            posFunc[dim1].w1.min,
                            posFunc[dim2].w1.min,
                            posFunc[dim1].w1.max,
                            posFunc[dim2].w1.max);
            nodeWisker1.enter.style('stroke-dasharray', whiskers_dasharray);
            svgSetCommonAttributesPerElem(nodeWisker1.enter, this.elements[i]);
            nodeWisker1.enter.style('fill', 'none');
            nodeWisker1.update.style('stroke-dasharray', whiskers_dasharray);
            svgSetCommonAttributesPerElem(nodeWisker1.update, this.elements[i]);
            nodeWisker1.update.style('fill', 'none');
            nodeWisker1.exit.remove();
            
            // Second whisker
            var nodeWisker2 = svg.selectAll('.'+eltClass+'.whisker.max')
                                .data(dataSubset);
            nodeWisker2 = drawSegment( nodeWisker2,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' whisker max',
                            getX,
                            getY,
                            posFunc[dim1].w2.min,
                            posFunc[dim2].w2.min,
                            posFunc[dim1].w2.max,
                            posFunc[dim2].w2.max);
            nodeWisker2.enter.style('stroke-dasharray', whiskers_dasharray);
            svgSetCommonAttributesPerElem(nodeWisker2.enter, this.elements[i]);
            nodeWisker2.enter.style('fill', 'none');
            nodeWisker2.update.style('stroke-dasharray', whiskers_dasharray);
            svgSetCommonAttributesPerElem(nodeWisker2.update, this.elements[i]);
            nodeWisker2.update.style('fill', 'none');
            nodeWisker2.exit.remove();
            
            // First whisker limite
            var nodeWiskerLimit1 = svg.selectAll('.'+eltClass+'.whisker_limit.min')
                                .data(dataSubset);
            nodeWiskerLimit1 = drawSegment( nodeWiskerLimit1,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' whisker_limit min',
                            getX,
                            getY,
                            posFunc[dim1].wl1.min,
                            posFunc[dim2].wl1.min,
                            posFunc[dim1].wl1.max,
                            posFunc[dim2].wl1.max);
            svgSetCommonAttributesPerElem(nodeWiskerLimit1.enter, this.elements[i]);
            nodeWiskerLimit1.enter.style('fill', 'none');
            svgSetCommonAttributesPerElem(nodeWiskerLimit1.update, this.elements[i]);
            nodeWiskerLimit1.update.style('fill', 'none');
            nodeWiskerLimit1.exit.remove();
            
            // Event
            var nodeW1Mask = svg.selectAll('.'+eltClass+'.whisker-mask.min')
                                .data(dataSubset);
            nodeW1Mask = drawSegment( nodeW1Mask,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' whisker-mask min',
                            getX,
                            getY,
                            posFunc[dim1].wl1.min,
                            posFunc[dim2].wl1.min,
                            posFunc[dim1].wl1.max,
                            posFunc[dim2].wl1.max);
            nodeW1Mask.enter.style('fill', 'none');
            nodeW1Mask.enter.style('stroke-width', 5);
            nodeW1Mask.enter.style('stroke', 'red');
            nodeW1Mask.enter.style('visibility', 'hidden');
            nodeW1Mask.enter.style('pointer-events', 'all');
            nodeW1Mask.enter.on('mouseover',  getOnMouseOver(this, eltClass+'w1', applyToString(boxplotStat.whisker1.aes.func)));
            nodeW1Mask.enter.on('mouseout',   getOnMouseOut(this));
            nodeW1Mask.enter.on('click',      getOnClick(this, eltClass+'w1', applyToString(boxplotStat.whisker1.aes.func)));
            nodeW1Mask.exit.remove();
            
            // Second whisker limite
            var nodeWiskerLimit2 = svg.selectAll('.'+eltClass+'.whisker_limit.max')
                                .data(dataSubset);
            nodeWiskerLimit2 = drawSegment( nodeWiskerLimit2,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' whisker_limit max',
                            getX,
                            getY,
                            posFunc[dim1].wl2.min,
                            posFunc[dim2].wl2.min,
                            posFunc[dim1].wl2.max,
                            posFunc[dim2].wl2.max);
            svgSetCommonAttributesPerElem(nodeWiskerLimit2.enter, this.elements[i]);
            nodeWiskerLimit2.enter.style('fill', 'none');
            svgSetCommonAttributesPerElem(nodeWiskerLimit2.update, this.elements[i]);
            nodeWiskerLimit2.update.style('fill', 'none');
            nodeWiskerLimit2.exit.remove();
            
            // Event
            var nodeW2Mask = svg.selectAll('.'+eltClass+'.whisker-mask.max')
                                .data(dataSubset);
            nodeW2Mask = drawSegment( nodeW2Mask,
                            deepestCoordSys,
                            this.transition_duration,
                            eltClass+' whisker-mask max',
                            getX,
                            getY,
                            posFunc[dim1].wl2.min,
                            posFunc[dim2].wl2.min,
                            posFunc[dim1].wl2.max,
                            posFunc[dim2].wl2.max);
            nodeW2Mask.enter.style('fill', 'none');
            nodeW2Mask.enter.style('stroke-width', 5);
            nodeW2Mask.enter.style('stroke', 'red');
            nodeW2Mask.enter.style('visibility', 'hidden');
            nodeW2Mask.enter.style('pointer-events', 'all');
            nodeW2Mask.enter.on('mouseover',  getOnMouseOver(this, eltClass+'w2', applyToString(boxplotStat.whisker2.aes.func)));
            nodeW2Mask.enter.on('mouseout',   getOnMouseOut(this));
            nodeW2Mask.enter.on('click',      getOnClick(this, eltClass+'w2', applyToString(boxplotStat.whisker2.aes.func)));
            nodeW2Mask.exit.remove();
          }
          else {
            ERROR('Type of element '+i+' is not an element but an '+getTypeName(this.elements[i]));
          }
        }
        
        // Iterate to the next data sub-set and svg group
        var goNextCoordSys = true;
        var subsetId = subset.length-2;
        var coordSysId = currentPos.length-1;
        if(currentPos.length == 0) {
          goNextCoordSys = false;
          stop = true;
        }
        while(goNextCoordSys) {
          var goNextDim = true;
          var dimId = currentPos[coordSysId].length-1;
          while(goNextDim) {
            currentPos[coordSysId][dimId]++;
            if(currentPos[coordSysId][dimId] >= maxPos[coordSysId][dimId]) {
              if(nonNullDim[coordSysId][dimId]) {
                subsetId--;
              }
              
              currentPos[coordSysId][dimId] = 0;
              dimId--;
              
              if(dimId < 0) {
                goNextDim = false;
              }
            }
            else {
              subset[subsetId+1] = subset[subsetId][currentPos[coordSysId][dimId]];
              for(var j = subsetId+2 ; j < subset.length ; j++) {
                subset[j] = subset[j-1][0];
              }
              
              var idGroup = '';
              for(var j = 0 ; j < maxPos[coordSysId].length ; j++) {
                var id = currentPos[coordSysId][j];
                idGroup += j ? '-'+id : '.sub-graphic-'+id;
              }
              svgGroups[coordSysId+1] = svgGroups[coordSysId].select(idGroup+'.depth'+(coordSysId+1));
              
              for(var j = coordSysId+2 ; j < svgGroups.length ; j++) {
                var idGroup = '';
                for(var k = 0 ; k < maxPos[j-1].length ; k++) {
                  idGroup += k ? '-0' : '.sub-graphic-0';
                }
                svgGroups[j] = svgGroups[j-1].select(idGroup+'.depth'+j);
              }
              
              goNextCoordSys = false;
              goNextDim = false;
            }
          }
          
          if(goNextCoordSys) {
            coordSysId--;
            if(coordSysId < 0) {
              goNextCoordSys = false;
              stop = true;
            }
          }
        }
      }
    }
    
    return this;
  };
  
  // Update position of time sliders' cursor
  Graphic.prototype.updateSliders = function() {
    var sliderSize = this.width;
    
    for(var i in this.timeSlider) {
      var slider = this.timeSlider[i];
      // Update scale if needed
      if(slider.mouseToValue.range() != this.dim[i].domain) {
        var values = new Array(this.dim[i].domain.length);
        for(var j = 0 ; j < this.dim[i].domain.length ; j++) {
          values[j] = this.dim[i].domain[j];
        }
        var dom = [];
        for(var j = 0 ; j < values.length - 1 ; j++){
          dom.push((j+0.8) * sliderSize / (values.length - 1));
        }
        slider.mouseToValue
              .domain(dom)
              .range(values);
        slider.valueToMouse
              .domain(values)
              .rangePoints([0, sliderSize], 0);
        
        slider.brush.x(slider.valueToMouse);
        slider.axis.tickValues(values);
        
        (this.transition_duration > 0
        ? slider.axisNode.transition().duration(this.transition_duration)
        : slider.axisNode)
        .call(slider.axis);
      }
      
      var value = this.dim[i].domain[this.currentTime[i]];
      var posX = this.timeSlider[i].valueToMouse(value);
      
      this.timeSlider[i].handle.transition().attr('cx', posX);
    }
    
    return this;
  };
  
  /* The function to render the plot                     */
  /* Automatically attaches itself to the window.onLoad  */
  /* From: http://stackoverflow.com/questions/6348494/addeventlistener-vs-onclick */
  Graphic.prototype.plot = function(param) {
    ASSERT(this.render, "No function render in this; how am I  supposed to render ??");
    
    // debugger
    var theGraphic = this;
    window.addEventListener("load", function() { theGraphic.render(param); }, true);
    
    return this;
  };
  
  
  ///////////////////////////
  // Render step functions //
  ///////////////////////////
  
  /* In the following functions, 'this' reference the graphic */
  
  /*
   * Load data
   * GoG pipeline step: Variables
   */
  var loadData = function(param) {
    if(this.dataset[main_dataset_name] == null) {
      if(this.dataLoader != null) {
        this.render_param = param;
        //TIMER_GROUP_BEGIN('Loading', this.display_timers);
        this.dataLoader.sendXhrRequest();
        return false;
      }
      else {
        ERROR('Can\'t plot without data');
      }
    }
    //TIMER_GROUP_END('Loading', this.display_timers);
    return true;
  }
  
  
  /*
   * Update data views (datasets computed from the main dataset)
   * GoG pipeline step: Algebra, Statistics
   */
  var updateDataViews = function() {
    TIMER_BEGIN('Generation of data views', this.display_timers);
    
    for(var i = 0 ; i < this.data_view_generator.length ; i++) {
      var name = this.data_view_generator[i].name;
      var func = this.data_view_generator[i].func;
      
      if(isUndefined(this.dataset[name])) {
        this.dataset[name] = {oldData:[],
                              newData:[]};
      }
      
      var param = { oldData:          this.dataset[main_dataset_name].oldData,
                    newData:          this.dataset[main_dataset_name].newData,
                    oldProcessedData: (this.dataset[main_dataset_name].oldData.length == 0)
                                      ? []
                                      : this.dataset[name].oldData};
      
      this.dataset[name] = func(param);
    }
    
    // Check if every element's dataset exists
    for(var i = 0 ; i < this.elements.length ; i++) {
      if(!(this.elements[i].datasetName in this.dataset)) {
        ERROR('Data view '+this.elements[i].datasetName+' of element '+i+' ('+getTypeName(this.elements[i])+') is not defined');
      }
    }
    TIMER_END('Generation of data views', this.display_timers);
  }
  
  /*
   * Merge old and new data
   * GoG pipeline step: None
   */
  var mergeOldAndNewData = function() {
    TIMER_BEGIN('Merge old and new data', this.display_timers);
    
    for(var name in this.dataset) {
      this.dataset[name] = this.dataset[name].oldData.concat(this.dataset[name].newData);
    }
    TIMER_END('Merge old and new data', this.display_timers);
  }
  
  
  /*
   * Cleaning and standardization of elements' attributes
   * GoG pipeline step: None
   */
  var elementsStandardization = function() {
    /*                                                *\
     * Detection of attributes which are dimensions   *
     * Store if the value is categorical in a boolean *
     * Deletion of useless attributes                 *
     * Add time dimensions as attribute               *
    \*                                                */
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i].attrs) {
        // This attribute is a dimension
        if(this.spacialDimName.indexOf(attr) >= 0 ||
           attr in this.temporalDim) {
          this.elements[i].attrs[attr].type = 'dimension';
        }
        
        // If the value of this attribute is categorical
        if(this.elements[i].attrs[attr].value instanceof CategoricalValue) {
          this.elements[i].attrs[attr].value = this.elements[i].attrs[attr].value.attrs.value;
          this.elements[i].attrs[attr].forceCat = true;
        }
        else {
          this.elements[i].attrs[attr].forceCat = false;
        }
        
        // Useless attribute
        if(this.elements[i].attrs[attr].type === 'unknown' ||
           this.elements[i].attrs[attr].value == null) {
          delete this.elements[i].attrs[attr];
        }
      }
      
      // Add time dimensions as attribute
      for(var attr in this.temporalDim) {
        if(isUndefined(this.elements[i].attrs[attr])) {
          this.elements[i].attrs[attr] = {  type:'dimension',
                                            value:this.temporalDim[attr],
                                            originFunc:'Graphic.time',
                                            forceCat:true};
        }
      }
    }
    
    
    /*                                               *\
     * Standardization of aesthetics                 *
     * Collecting some informations about dimensions *
    \*                                               */
    TIMER_BEGIN('Standardization of elements\' attributes', this.display_timers);
    var deepestCoordSysDim = [];
    for(var i in this.dim) {
      if(!this.dim[i].forceOrdinal) {
        deepestCoordSysDim.push(i);
      }
    }
    var deepestCoordSysDimNames = '';
    for(var i = 0 ; i < deepestCoordSysDim.length ; i++) {
      deepestCoordSysDimNames += i ? (i == deepestCoordSysDim.length-1 ? ' and ' : ', ') : '';
      deepestCoordSysDimNames += deepestCoordSysDim[i];
    }
    
    // Aesthetics
    var aes = [];
    // Map data column name -> aesthetic id
    var dataCol2Aes = {};
    // Map function -> aesthetic id
    var func2Aes = {};
    // Map const value -> aesthetic id
    var const2Aes = {};
    this.nbCalcultedValues = {};
    
    for(var i = 0 ; i < this.elements.length ; i++) {
      var datasetName = this.elements[i].datasetName;
      var dataset = this.dataset[datasetName];
      if(isUndefined(this.nbCalcultedValues[datasetName])) {
        this.nbCalcultedValues[datasetName] = 0;
      }
      for(var attr in this.elements[i].attrs) {
        var attr_type = this.elements[i].attrs[attr].type;
        var attr_val = this.elements[i].attrs[attr].value;
        var originFunc = this.elements[i].attrs[attr].originFunc;
        
        
        if(attr_type == 'dimension' && isUndefined(this.dim[attr].aes)) {
          this.dim[attr].aes = [];
          this.dim[attr].aesElemId = [];
        }
        
        if(attr_val instanceof Interval && attr_type == 'dimension') {
          if(!(this.elements[i] instanceof Bar)) {
            ERROR(getTypeName(this.elements[i])+' can\'t have an interval as position ('+attr+')');
          }
          
          if(deepestCoordSysDim.indexOf(attr) < 0) {
            var msg = 'Attribute '+attr+' can\'t be an interval. '+
                      'Only '+deepestCoordSysDimNames+' can be.';
            ERROR(msg);
          }
          
          originFunc = lib_name+'.interval'+(attr_val.stacked ? '.stack' : '');
          
          var aesId1 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.attrs.boundary1.value, datasetName, attr, originFunc);
          var aesId2 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.attrs.boundary2.value, datasetName, attr, originFunc);
          
          // Check data type return by those aesthetics
          var aes_ret_type = typeof aes[aesId1].func(dataset[0], 0);
          checkAesType('number', aes_ret_type, 'first param', originFunc);
          aes_ret_type = typeof aes[aesId2].func(dataset[0], 0);
          checkAesType('number', aes_ret_type, 'second param', originFunc);
          
          attr_val.attrs.boundary1.aes = aes[aesId1];
          attr_val.attrs.boundary2.aes = aes[aesId2];
          
          // Not stacked
          if(!attr_val.stacked) {
            this.dim[attr].aes.push(attr_val.attrs.boundary1.aes);
            this.dim[attr].aesElemId.push(i);
            this.dim[attr].aes.push(attr_val.attrs.boundary2.aes);
            this.dim[attr].aesElemId.push(i);
            
            attr_val.attrs.boundary1.func = attr_val.attrs.boundary1.aes.func;
            attr_val.attrs.boundary2.func = attr_val.attrs.boundary2.aes.func;
          }
          else {
            var Id = this.nbCalcultedValues[datasetName];
            this.nbCalcultedValues[datasetName] += 2;
            attr_val.attrs.boundary1.Id = Id;
            attr_val.attrs.boundary2.Id = Id+1;
            
            var getFunc = function(Id) {
              return function(d) {
                return d._calculated_values[Id];
              };
            };
            
            attr_val.attrs.boundary1.func = getFunc(Id);
            attr_val.attrs.boundary2.func = getFunc(Id+1);
            
            this.dim[attr].aes.push({ func:attr_val.attrs.boundary1.func,
                                      datasetName:datasetName});
            this.dim[attr].aesElemId.push(i);
            this.dim[attr].aes.push({ func:attr_val.attrs.boundary2.func,
                                      datasetName:datasetName});
            this.dim[attr].aesElemId.push(i);
          }
        }
        else if(attr_val instanceof BoxPlotBoxStat && attr_type == 'dimension') {
          originFunc = lib_name+'.boxplotStat';
          
          if(!(this.elements[i] instanceof BoxPlot)) {
            ERROR(getTypeName(this.elements[i])+' can\'t have its position ('+attr+') set with '+originFunc);
          }
          
          if(deepestCoordSysDim.indexOf(attr) < 0) {
            var msg = 'Attribute '+attr+' can\'t be set with '+originFunc+'. '+
                      'Only '+deepestCoordSysDimNames+' can be.';
            ERROR(msg);
          }
          
          
          var aesQ1 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.attrs.quartile1.value, datasetName, attr, originFunc);
          var aesQ2 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.attrs.quartile2.value, datasetName, attr, originFunc);
          var aesQ3 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.attrs.quartile3.value, datasetName, attr, originFunc);
          var aesW1 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.attrs.whisker1.value,  datasetName, attr, originFunc);
          var aesW2 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.attrs.whisker2.value,  datasetName, attr, originFunc);
          
          var aes_ret_type = typeof aes[aesQ1].func(dataset[0], 0);
          checkAesType('number', aes_ret_type, 'quartile1', originFunc);
          aes_ret_type = typeof aes[aesQ2].func(dataset[0], 0);
          checkAesType('number', aes_ret_type, 'quartile2', originFunc);
          aes_ret_type = typeof aes[aesQ3].func(dataset[0], 0);
          checkAesType('number', aes_ret_type, 'quartile3', originFunc);
          aes_ret_type = typeof aes[aesW1].func(dataset[0], 0);
          checkAesType('number', aes_ret_type, 'whisker1', originFunc);
          aes_ret_type = typeof aes[aesW2].func(dataset[0], 0);
          checkAesType('number', aes_ret_type, 'whisker2', originFunc);
          
          attr_val.attrs.quartile1.aes = aes[aesQ1];
          attr_val.attrs.quartile2.aes = aes[aesQ2];
          attr_val.attrs.quartile3.aes = aes[aesQ3];
          attr_val.attrs.whisker1.aes =  aes[aesW1];
          attr_val.attrs.whisker2.aes =  aes[aesW2];
          
          // Just min and max values
          this.dim[attr].aes.push(attr_val.attrs.whisker1.aes);
          this.dim[attr].aesElemId.push(i);
          this.dim[attr].aes.push(attr_val.attrs.whisker2.aes);
          this.dim[attr].aesElemId.push(i);
        }
        else {
          // Get the aestetic id
          var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val, datasetName, attr, originFunc);
          
          // Check data type return by this aesthetic
          var aes_ret_type = typeof aes[aesId].func(dataset[0], 0);
          checkAesType(attr_type, aes_ret_type, attr, originFunc);
          
          
          if(attr_type == 'dimension') {
            this.dim[attr].aes.push(aes[aesId]);
            this.dim[attr].aesElemId.push(i);
          }
          
          this.elements[i].attrs[attr].aes = aes[aesId];
          this.elements[i].attrs[attr].aes.ret_type = aes_ret_type;
        }
      }
      
      if(this.elements[i] instanceof BoxPlot) {
        var nbBoxPlotStat = 0;
        for(var j = 0 ; j < deepestCoordSysDim.length ; j++) {
          if(this.elements[i].attrs[deepestCoordSysDim[j]].value instanceof BoxPlotBoxStat) {
            nbBoxPlotStat++;
          }
        }
        
        if(nbBoxPlotStat != 1) {
          ERROR('One and only one of the attributes '+deepestCoordSysDimNames+' must be set with '+lib_name+'.boxplotStat');
        }
      }
        
      // Checking for unset dimension attribute
      for(var j in this.dim) {
        if(isUndefined(this.elements[i].attrs[j]) && this.dim[j].isSpacial) {
          ERROR('No value found for the attribute '+j+' of '+getTypeName(this.elements[i]));
        }
      }
    }
    TIMER_END('Standardization of elements\' attributes', this.display_timers);
  }
  
  
  /*
   * Compute scale for every aesthetic which need it 
   * Also compute interval.stack values because this the only place
   * where we can compute it (after nesting data and before computing
   * scales themselves)
   * GoG pipeline step: "Scale", Geometry, Coordinates, Aesthetics
   */
  var computeScales = function() {
    /*                                                         *\
     * Computing dimensions' domains                           *
     * EXCEPT the deepest spacial coordinate system dimensions *
    \*                                                         */
    TIMER_GROUP_BEGIN('Computing scales', this.display_timers);
    TIMER_BEGIN('Computing dimension domain 1/2', this.display_timers);
    for(var i in this.dim) {
      if(isUndefined(this.dim[i].aes)) {
        ERROR('Error: dimension '+i+' unused');
      }
      
      if(!this.dim[i].forceOrdinal) {
        continue;
      }
      
      var domain = [];
      for(var j = 0 ; j < this.dim[i].aes.length ; j++) {
        // Compute discret domain
        var dataset = this.dataset[this.dim[i].aes[j].datasetName];
        computeDomain(this.dim[i].aes[j], dataset, 'discret');
        var dom = this.dim[i].aes[j].discretDomain;
        
        for(var k = 0 ; k < dom.length ; k++) {
          domain.push(dom[k]);
        }
      }
      RemoveDupArray(domain);
      
      
      this.dim[i].domain = domain;
      this.dim[i].discret = true;
    }
    TIMER_END('Computing dimension domain 1/2', this.display_timers);
    
    
    /*                                 *\
     * Splitting data for each element *
    \*                                 */
    TIMER_BEGIN('Nesting data', this.display_timers);
    // Initialising current 'time' (i.e. position in spacial dimensions)
    this.currentTime = [];
    for(var i in this.dim) {
      if(!this.dim[i].isSpacial) {
        this.currentTime[i] = 0;
      }
    }
    
    // Sizes of each splits, sub-splits, etc
    var splitSizes = [];
    
    // Splitting data according to temporal dimensions
    this.splitTempDimId = [];
    for(var i in this.currentTime) {
      // Split
      this.splitTempDimId.push(i);
      splitSizes.push(this.dim[i].domain.length);
    }
    
    // Splitting data according to spacial dimensions in the same order
    // coordinates system are imbricated. That important because when
    // displaying elements, we want to go throught data in that order
    this.splitSpacialDimId = [];
    var coordSys = this.spacialCoord;
    while(coordSys.subSys != null) {
      for(var i = 0 ; i < coordSys.dimName.length ; i++) {
        var dimAlias = coordSys.dimAlias[coordSys.dimName[i]];
        if(dimAlias != null) {
          this.splitSpacialDimId.push(dimAlias);
          splitSizes.push(this.dim[dimAlias].domain.length);
        }
      }
      coordSys = coordSys.subSys;
    }
    
    this.nestedData = [];
    
    for(var i = 0 ; i < this.elements.length ; i++) {
      var dataset = this.dataset[this.elements[i].datasetName];
      
      // Splitting data according to group
      var groupAes = this.elements[i].attrs.group.aes;
      computeDomain(groupAes, dataset, 'discret');
      splitSizes.push(groupAes.discretDomain.length);
      this.nestedData.push(allocateSplitDataArray(splitSizes, 0));
      splitSizes.pop();
      
      for(var j = 0 ; j < dataset.length ; j++) {
        var dataSubset = this.nestedData[i];
        
        for(var k = 0 ; k < this.splitTempDimId.length ; k++) {
          var value = this.elements[i].attrs[this.splitTempDimId[k]].aes.func(dataset[j], j);
          var id = this.dim[this.splitTempDimId[k]].domain.indexOf(value);
          dataSubset = dataSubset[id];
        }
        
        for(var k = 0 ; k < this.splitSpacialDimId.length ; k++) {
          var value = this.elements[i].attrs[this.splitSpacialDimId[k]].aes.func(dataset[j], j);
          var id = this.dim[this.splitSpacialDimId[k]].domain.indexOf(value);
          dataSubset = dataSubset[id];
        }
        
        var groupAes = this.elements[i].attrs.group.aes;
        var value = groupAes.func(dataset[j], j);
        var id = groupAes.discretDomain.indexOf(value);
        dataSubset = dataSubset[id];
        
        dataSubset.push(dataset[j]);
      }
    }
    TIMER_END('Nesting data', this.display_timers);
    
    
    /*                                   *\
     * Computing stacked interval values *
    \*                                   */
    TIMER_BEGIN('Computing stacked intervals\'values', this.display_timers);
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i].attrs) {
        var attr_val = this.elements[i].attrs[attr].value;
        if(attr_val instanceof Interval && attr_val.stacked) {
          var dataset = this.dataset[this.elements[i].datasetName];
          var originFunc = attr_val.attrs.boundary2.aes.func;
          var stepFunc = attr_val.attrs.boundary1.aes.func;
          
          if(isUndefined(dataset[0]._calculated_values)) {
            for(var j = 0 ; j < dataset.length ; j++) {
              dataset[j]._calculated_values = [];
            }
          }
          
          var Id = attr_val.attrs.boundary1.Id;
          
          var it = new HierarchyIterator(this.nestedData[i]);
          while(it.hasNext()) {
            var dataSubset = it.next();
            
            if(dataSubset.length > 0) {
              dataSubset[0]._calculated_values[Id] = originFunc(dataSubset[0], 0);
              dataSubset[0]._calculated_values[Id+1] = stepFunc(dataSubset[0], 0);
            }
            for(var j = 1 ; j < dataSubset.length ; j++) {
              dataSubset[j]._calculated_values[Id] = dataSubset[j-1]._calculated_values[Id+1];
              dataSubset[j]._calculated_values[Id+1] = dataSubset[j]._calculated_values[Id] + stepFunc(dataSubset[j], j);
            }
          }
        }
      }
    }
    TIMER_END('Computing stacked intervals\'values', this.display_timers);
    
    
    /*                                          *\
     * Computing the deepest spacial coordinate *
     * system dimensions' domains               *
    \*                                          */
    TIMER_BEGIN('Computing dimension domain 2/2', this.display_timers);
    for(var i in this.dim) {
      var dim = this.dim[i];
      if(dim.forceOrdinal) {
        continue;
      }
      
      var domain;
      var ordinal;
      
      // Don't force discret domain (i.e. continue if only number values)
      var discret = false;
      for(var j = 0 ; j < dim.aes.length ; j++) {
        if(this.elements[dim.aesElemId[j]].attrs[i].forceCat) {
          discret = true;
          break;
        }
        
        var dataset = this.dataset[dim.aes[j].datasetName];
        if(typeof dim.aes[j].func(dataset[0], 0) != 'number') {
          discret = true;
          break;
        }
      }
      
      // Discret domain
      if(discret) {
        domain = [];
        for(var j = 0 ; j < dim.aes.length ; j++) {
          var it = new HierarchyIterator(this.nestedData[dim.aesElemId[j]]);
          while(it.hasNext()) {
            var dataSubset = it.next();
            // Compute discret domain
            if(isUndefined(dim.aes[j].discretDomain)) {
              dim.aes[j].discretDomain = [];
            }
            updateDomain(dim.aes[j], dataSubset, 'discret');
            var dom = dim.aes[j].discretDomain;
            for(var k = 0 ; k < dom.length ; k++) {
              domain.push(dom[k]);
            }
          }
        }
        RemoveDupArray(domain);
      }
      // Continue domain
      else {
        domain = [Infinity, -Infinity];
        var dim = this.dim[i];
        for(var j = 0 ; j < dim.aes.length ; j++) {
          var it = new HierarchyIterator(this.nestedData[dim.aesElemId[j]]);
          while(it.hasNext()) {
            var dataSubset = it.next();
            // Compute continue domain
            if(isUndefined(dim.aes[j].continuousDomain)) {
              dim.aes[j].continuousDomain = [Infinity, -Infinity];
            }
            updateDomain(dim.aes[j], dataSubset, 'continue');
            var dom = dim.aes[j].continuousDomain;
            
            if(dom[0] < domain[0])
              domain[0] = dom[0];
            if(dom[1] > domain[1])
              domain[1] = dom[1];
          }
        }
        if(domain[0] == domain[1]) {
          domain = addPadding(domain, this.linear_scale_padding);
        }
      }
      
      this.dim[i].domain = domain;
      this.dim[i].discret = discret;
    }
    TIMER_END('Computing dimension domain 2/2', this.display_timers);
    
    
    /*                  *\
     * Computing scales *
    \*                  */
    TIMER_BEGIN('Computing scales themselves', this.display_timers);
    // For the coordinate system
    this.spacialCoord.computeScale( this.dim, 
                                    this.width,
                                    this.height);
    
    // For other attributes
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i].attrs) {
        // Skip dimension attributes
        if(this.elements[i].attrs[attr].type === 'dimension') {
          continue;
        }
        
        var attr_type = this.elements[i].attrs[attr].type;
        var attr_aes = this.elements[i].attrs[attr].aes;
        var forceCategorical = this.elements[i].attrs[attr].forceCat;
        
        switch(attr_type) {
          case 'color':
            if(attr_aes.ret_type === 'string' && !forceCategorical) {
              // No scaling
              this.elements[i].attrs[attr].func = attr_aes.func;
            }
            else {
              // Compute continuous domain
              computeDomain(attr_aes, this.dataset[attr_aes.datasetName], 'discret');
              
              // Scaling
              var scale = d3.scale.category10().domain(attr_aes.discretDomain);
              
              this.elements[i].attrs[attr].func = scale.compose(attr_aes.func);
            }
            break;
          
          case 'symbol':
            if(attr_aes.ret_type === 'string' && !forceCategorical) {
              // No scaling
              this.elements[i].attrs[attr].func = attr_aes.func;
            }
            else {
              // Compute discret domain
              computeDomain(attr_aes, this.dataset[attr_aes.datasetName], 'discret');
              
              // Scaling
              var scale = d3.scale.ordinal()
                                  .domain(attr_aes.discretDomain)
                                  .range(d3.svg.symbolTypes);
              
              this.elements[i].attrs[attr].func = scale.compose(attr_aes.func);
            }
            break;
          
          case 'string':
            // No scaling
            if(attr_aes.ret_type === 'string') {
              this.elements[i].attrs[attr].func = attr_aes.func;
            }
            else { // Just apply toString
              var applyToString = function (f) {
                return function (d, i) {
                  return f(d, i).toString();
                }
              };
              this.elements[i].attrs[attr].func = applyToString(attr_aes.func);
            }
            break;
          
          case 'number':
            // No scaling
            this.elements[i].attrs[attr].func = attr_aes.func;
            break;
        }
      }
    }
    TIMER_END('Computing scales themselves', this.display_timers);
    TIMER_GROUP_END('Computing scales', this.display_timers);
  }
  
  
  /*
   * Update scales
   */
  var updateScales = function() {
    /*                                                         *\
     * Update dimensions' domains                              *
     * EXCEPT the deepest spacial coordinate system dimensions *
    \*                                                         */
    TIMER_GROUP_BEGIN('Updating scales', this.display_timers);
    TIMER_BEGIN('Updating dimension domain 1/2', this.display_timers);
    
    // Re-init domain where no old data
    for(var i in this.dim) {
      for(var j = 0 ; j < this.dim[i].aes.length ; j++) {
        var aes = this.dim[i].aes[j];
        var oldData = this.dataset[aes.datasetName].oldData;
        if(oldData.length == 0) {
          aes.discretDomain = [];
          aes.continuousDomain = [Infinity, -Infinity];
          
          if(this.dim[i].discret) {
            this.dim[i].domain = [];
          }
          else {
            this.dim[i].domain = [Infinity, -Infinity];
          }
          this.dim[i].reseted = true;
        }
      }
    }
    for(var i = 0 ; i < this.elements.length ; i++) {
      var datasetName = this.elements[i].datasetName;
      var oldData = this.dataset[datasetName].oldData;
      for(var attr in this.elements[i].attrs) {
        var attr_val = this.elements[i].attrs[attr].value;
        if(this.elements[i].attrs[attr].type != 'dimension') {
          var aes = this.elements[i].attrs[attr].aes;
          if(oldData.length == 0) {
            aes.discretDomain = [];
            aes.continuousDomain = [Infinity, -Infinity];
          }
        }
      }
    }
    
    for(var i in this.dim) {
      if(!this.dim[i].forceOrdinal) {
        continue;
      }
      
      var domain = this.dim[i].domain;
      for(var j = 0 ; j < this.dim[i].aes.length ; j++) {
        // Compute discret domain
        var newData = this.dataset[this.dim[i].aes[j].datasetName].newData;
        var newValues = updateDomain(this.dim[i].aes[j], newData, 'discret');
        
        for(var k = 0 ; k < newValues.length ; k++) {
          domain.push(newValues[k]);
        }
      }
      RemoveDupArray(domain);
      
      this.dim[i].domain = domain;
    }
    TIMER_END('Updating dimension domain 1/2', this.display_timers);
    
    
    /*                                 *\
     * Splitting data for each element *
    \*                                 */
    TIMER_BEGIN('Nesting data', this.display_timers);
    
    // Sizes of each splits, sub-splits, etc
    var splitSizes = [];
    
    // Splitting data according to temporal dimensions
    for(var i = 0 ; i < this.splitTempDimId.length ; i++) {
      splitSizes.push(this.dim[this.splitTempDimId[i]].domain.length);
    }
    
    // Splitting data according to spacial dimensions
    for(var i = 0 ; i < this.splitSpacialDimId.length ; i++) {
      splitSizes.push(this.dim[this.splitSpacialDimId[i]].domain.length);
    }
    
    // Updating domain of group attribute
    for(var i = 0 ; i < this.elements.length ; i++) {
      var dataset = this.dataset[this.elements[i].datasetName].newData;
      var groupAes = this.elements[i].attrs.group.aes;
      updateDomain(groupAes, dataset, 'discret');
    }
    
    this.nestedData = [];
    
    var nestedData = {oldData:[],
                      newData:[]};
    
    for(var dataCat in nestedData) {
      for(var i = 0 ; i < this.elements.length ; i++) {
        var dataset = this.dataset[this.elements[i].datasetName][dataCat];
        
        // Splitting data according to group
        var groupAes = this.elements[i].attrs.group.aes;
        splitSizes.push(groupAes.discretDomain.length);
        nestedData[dataCat].push(allocateSplitDataArray(splitSizes, 0));
        splitSizes.pop();
        
        for(var j = 0 ; j < dataset.length ; j++) {
          var dataSubset = nestedData[dataCat][i];
          
          for(var k = 0 ; k < this.splitTempDimId.length ; k++) {
            var value = this.elements[i].attrs[this.splitTempDimId[k]].aes.func(dataset[j], j);
            var id = this.dim[this.splitTempDimId[k]].domain.indexOf(value);
            dataSubset = dataSubset[id];
          }
          
          for(var k = 0 ; k < this.splitSpacialDimId.length ; k++) {
            var value = this.elements[i].attrs[this.splitSpacialDimId[k]].aes.func(dataset[j], j);
            var id = this.dim[this.splitSpacialDimId[k]].domain.indexOf(value);
            dataSubset = dataSubset[id];
          }
          
          var groupAes = this.elements[i].attrs.group.aes;
          var value = groupAes.func(dataset[j], j);
          var id = groupAes.discretDomain.indexOf(value);
          dataSubset = dataSubset[id];
          
          dataSubset.push(dataset[j]);
        }
      }
    }
    
    for(var i = 0 ; i < this.elements.length ; i++) {
      var groupAes = this.elements[i].attrs.group.aes;
      splitSizes.push(groupAes.discretDomain.length);
      this.nestedData.push(allocateSplitDataArray(splitSizes, 0));
      splitSizes.pop();
    }
    
    var itNew = new HierarchyIterator(nestedData.newData);
    var itOld = new HierarchyIterator(nestedData.oldData);
    var it    = new HierarchyIterator(this.nestedData);
    
    while(it.hasNext()) {
      var newData = itNew.next();
      var oldData = itOld.next();
      var dataSubset = it.next();
      
      for(var i = 0 ; i < oldData.length ; i++) {
        dataSubset.push(oldData[i]);
      }
      for(var i = 0 ; i < newData.length ; i++) {
        dataSubset.push(newData[i]);
      }
    }
    
    TIMER_END('Nesting data', this.display_timers);
    
    
    /*                                      *\
     * Computing stacked interval functions *
    \*                                      */
    TIMER_BEGIN('Updating stacked intervals\'values', this.display_timers);
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i].attrs) {
        var attr_val = this.elements[i].attrs[attr].value;
        if(attr_val instanceof Interval && attr_val.stacked) {
          var originFunc = attr_val.attrs.boundary2.aes.func;
          var stepFunc = attr_val.attrs.boundary1.aes.func;
          var Id = attr_val.attrs.boundary1.Id;
          
          var it = new HierarchyIterator(this.nestedData[i]);
          while(it.hasNext()) {
            var dataSubset = it.next();
            
            if(dataSubset.length > 0) {
              if(isUndefined(dataSubset[0]._calculated_values)) {
                dataSubset[0]._calculated_values = [];
              }
              
              dataSubset[0]._calculated_values[Id] = originFunc(dataSubset[0], 0);
              dataSubset[0]._calculated_values[Id+1] = stepFunc(dataSubset[0], 0);
            }
            for(var j = 1 ; j < dataSubset.length ; j++) {
              if(isUndefined(dataSubset[j]._calculated_values)) {
                dataSubset[j]._calculated_values = [];
              }
              
              dataSubset[j]._calculated_values[Id] = dataSubset[j-1]._calculated_values[Id+1];
              dataSubset[j]._calculated_values[Id+1] = dataSubset[j]._calculated_values[Id] + stepFunc(dataSubset[j], j);
            }
          }
        }
      }
    }
    TIMER_END('Updating stacked intervals\'values', this.display_timers);
    
    
    /*                                          *\
     * Computing the deepest spacial coordinate *
     * system dimensions' domains               *
    \*                                          */
    TIMER_BEGIN('Updating dimension domain 2/2', this.display_timers);
    for(var i in this.dim) {
      if(this.dim[i].forceOrdinal) {
        continue;
      }
      
      var domain = this.dim[i].domain;
      
      // Discret domain
      if(this.dim[i].discret) {
        domain = [];
        var dim = this.dim[i];
        for(var j = 0 ; j < dim.aes.length ; j++) {
          var it =  (this.dim[i].reseted)
                    ? new HierarchyIterator(this.nestedData[dim.aesElemId[j]])
                    : new HierarchyIterator(nestedData.newData[dim.aesElemId[j]]);
          while(it.hasNext()) {
            var dataSubset = it.next();
            // Compute discret domain
            if(isUndefined(dim.aes[j].discretDomain)) {
              dim.aes[j].discretDomain = [];
            }
            updateDomain(dim.aes[j], dataSubset, 'discret');
            var dom = dim.aes[j].discretDomain;
            for(var k = 0 ; k < dom.length ; k++) {
              domain.push(dom[k]);
            }
          }
        }
        RemoveDupArray(domain);
      }
      // Continue domain
      else {
        domain = [Infinity, -Infinity];
        var dim = this.dim[i];
        for(var j = 0 ; j < dim.aes.length ; j++) {
          var it =  (this.dim[i].reseted)
                    ? new HierarchyIterator(this.nestedData[dim.aesElemId[j]])
                    : new HierarchyIterator(nestedData.newData[dim.aesElemId[j]]);
          while(it.hasNext()) {
            var dataSubset = it.next();
            // Compute continue domain
            updateDomain(dim.aes[j], dataSubset, 'continue');
            var dom = dim.aes[j].continuousDomain;
            
            if(dom[0] < domain[0])
              domain[0] = dom[0];
            if(dom[1] > domain[1])
              domain[1] = dom[1];
          }
        }
        if(domain[0] == domain[1]) {
          domain = addPadding(domain, this.linear_scale_padding);
        }
      }
      
      this.dim[i].domain = domain;
    }
    TIMER_END('Updating dimension domain 2/2', this.display_timers);
    
    
    /*                  *\
     * Computing scales *
    \*                  */
    TIMER_BEGIN('Updating scales themselves', this.display_timers);
    // For the coordinate system
    this.spacialCoord.computeScale( this.dim, 
                                    this.width,
                                    this.height);
    
    // For other attributes
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i].attrs) {
        // Skip dimension attributes
        if(this.elements[i].attrs[attr].type === 'dimension') {
          continue;
        }
        
        var attr_type = this.elements[i].attrs[attr].type;
        var attr_aes = this.elements[i].attrs[attr].aes;
        var forceCategorical = this.elements[i].attrs[attr].forceCat;
        
        switch(attr_type) {
          case 'color':
            if(attr_aes.ret_type === 'string' && !forceCategorical) {
              // No scaling
              this.elements[i].attrs[attr].func = attr_aes.func;
            }
            else {
              // Compute discret domain
              updateDomain(attr_aes, this.dataset[attr_aes.datasetName], 'discret');
              
              // Scaling
              var scale = d3.scale.category10().domain(attr_aes.discretDomain);
              
              this.elements[i].attrs[attr].func = scale.compose(attr_aes.func);
            }
            break;
          
          case 'symbol':
            if(attr_aes.ret_type === 'string' && !forceCategorical) {
              // No scaling
              this.elements[i].attrs[attr].func = attr_aes.func;
            }
            else {
              // Compute discret domain
              updateDomain(attr_aes, this.dataset[attr_aes.datasetName], 'discret');
              
              // Scaling
              var scale = d3.scale.ordinal()
                                  .domain(attr_aes.discretDomain)
                                  .range(d3.svg.symbolTypes);
              
              this.elements[i].attrs[attr].func = scale.compose(attr_aes.func);
            }
            break;
          
          case 'string':
            // No scaling
            if(attr_aes.ret_type === 'string') {
              this.elements[i].attrs[attr].func = attr_aes.func;
            }
            else { // Just apply toString
              var applyToString = function (f) {
                return function (d, i) {
                  return f(d, i).toString();
                }
              };
              this.elements[i].attrs[attr].func = applyToString(attr_aes.func);
            }
            break;
          
          case 'number':
            // No scaling
            this.elements[i].attrs[attr].func = attr_aes.func;
            break;
        }
      }
    }
    TIMER_END('Updating scales themselves', this.display_timers);
    TIMER_GROUP_END('Updating scales', this.display_timers);
  }
  
  
  /*
   * Generate the svg code
   * GoG pipeline step: Geometry, Coordinates, Aesthetics
   */
  var generateSVG = function() {
    TIMER_GROUP_BEGIN('Generating SVG', this.display_timers);
    
    // Remove loading bar
    this.svg.select('#loading-bar').remove();
    
    var svg = this.svg.append('g')
                .attr('class', 'depth0')
                .attr('transform', 'translate('+this.margin.left+','+this.margin.top+')');
    
    // Draw axises, backgrounds, and generate svg base to add elements
    TIMER_BEGIN('Drawing background and axises', this.display_timers);
    this.spacialCoord.updateSVG(svg, this.dim, this.width, this.height, 0);
    TIMER_END('Drawing background and axises', this.display_timers);
    
    // Add time sliders
    TIMER_BEGIN('Drawing sliders', this.display_timers);
    var getOnBrushed = function(slider, g) {
      return function(){
        var posX = slider.brush.extent()[0];

        if (d3.event.sourceEvent) { // not a programmatic event
          posX = d3.mouse(this)[0];
          
          posX = posX.clamp(0, sliderSize);
          
          slider.brush.extent([posX, posX]);
        }
        
        slider.handle.interrupt().transition();
        slider.handle.attr("cx", posX);
        var index = g.dim[slider.dimName].domain.indexOf(slider.mouseToValue(posX));
        if(g.currentTime[slider.dimName] != index) {
          g.currentTime[slider.dimName] = index;
          g.updateElements();
          removePopups(g);
        }
      }
    };
    
    var getOnBrushEnd = function(slider, g) {
      return function(){
        var posX = slider.brush.extent()[0];

        if (d3.event.sourceEvent) { // not a programmatic event
          posX = d3.mouse(this)[0];
          posX.clamp(0, sliderSize);
          
          posX = slider.valueToMouse(slider.mouseToValue(posX));
          
          slider.brush.extent([posX, posX]);
        }
        
        slider.handle.interrupt().transition().attr("cx", posX);
      }
    };
    
    this.timeSlider = {};
    var sliderSize = this.width;
    var offsetY = this.height + this.margin.top + this.margin.bottom;
    
    for(var i in this.dim) {
      if(this.dim[i].isSpacial) {
        continue;
      }
      
      this.timeSlider[i] = {};
      
      var values = new Array(this.dim[i].domain.length);
      for(var j = 0 ; j < this.dim[i].domain.length ; j++) {
        values[j] = this.dim[i].domain[j];
      }
      var dom = [];
      for(var j = 0 ; j < values.length - 1 ; j++){
        dom.push((j+0.8) * sliderSize / (values.length - 1));
      }
      var mouseToValue = d3.scale.threshold()
                                 .domain(dom)
                                 .range(values);
      var valueToMouse = d3.scale.ordinal()
                                 .domain(values)
                                 .rangePoints([0, sliderSize], 0);
      
      var axis = d3.svg.axis()
                   .scale(valueToMouse)
                   .tickValues(values) // TODO: if only numbers, don't generate 1 tick per value
                   .orient('bottom')
                   .tickSize(0)
                   .tickPadding(12);
      
      var brush = d3.svg.brush()
                    .x(valueToMouse)
                    .extent([0, 0]);
      
      var slider = this.svg.append('g').attr('class', 'slider '+i)
                                       .attr('transform', 'translate('+this.margin.left+','+offsetY+')');
      this.timeSlider[i].svg = slider;
      
      var axisNode = slider.append('g').attr('class', 'axis')
                                   .attr('transform', 'translate(0,'+sliderHeight/2 +')')
                                   .style('font', '10px sans-serif')
                                   .style('-webkit-user-select', 'none')
                                   .style('-moz-user-select', 'none')
                                   .style('user-select', 'none')
                                   .call(axis);
      
      axisNode.select('.domain').style('fill', 'none')
                                .style('stroke', '#000')
                                .style('stroke-opacity', '0.3')
                                .style('stroke-width', '10')
                                .style('stroke-linecap', 'round')
          .select(function(){return this.parentNode.appendChild(this.cloneNode(true));})
                                .style('stroke', '#ddd')
                                .style('stroke-opacity', '1')
                                .style('stroke-width', '8');
      
      var brushNode = slider.append('g').attr('class', 'brush')
                                        .call(brush);
      
      brushNode.selectAll('.extent,.resize').remove();
      brushNode.select('.background').attr('width', sliderSize + handleSize)
                                 .attr('height', handleSize)
                                 .attr('x', -handleSize/2)
                                 .attr('transform', 'translate(0,'+(sliderHeight/2-handleSize/2)+')')
                                 .style('cursor', 'auto');
      
      var handle = brushNode.append('circle').attr('class', 'handle')
                                             .attr('transform', 'translate(0,'+(sliderHeight/2)+')')
                                             .attr('r', handleSize/2)
                                             .style('fill', '#fff')
                                             .style('stroke', '#000')
                                             .style('stroke-opacity', '0.5')
                                             .style('stroke-width', '1.25px')
                                             .style('pointer-events', 'none');
      
      this.timeSlider[i].dimName = i;
      this.timeSlider[i].mouseToValue = mouseToValue;
      this.timeSlider[i].valueToMouse = valueToMouse;
      this.timeSlider[i].axis = axis;
      this.timeSlider[i].axisNode = axisNode;
      this.timeSlider[i].brush = brush;
      this.timeSlider[i].handle = handle;
      
      brush.on('brush', getOnBrushed(this.timeSlider[i], this));
      brush.on('brushend', getOnBrushEnd(this.timeSlider[i], this));
      handle.call(brush.event);
      
      offsetY += sliderHeight;
    }
    this.updateSliders();
    TIMER_END('Drawing sliders', this.display_timers);
    
    // Draw elements
    TIMER_BEGIN('Drawing elements', this.display_timers);
    this.updateElements();
    TIMER_END('Drawing elements', this.display_timers);
    
    TIMER_GROUP_END('Generating SVG', this.display_timers);
  }
  
  
  /////////////////////////
  // Elements definition //
  /////////////////////////
  
  function ElementBase() {
    this.attrs = {
        group:            { type:'string',
                            value:'1'},
        fill:             { type:'color',
                            value:null},
        fill_opacity:     { type:'number',
                            value:null},
        stroke_width:     { type:'number',
                            value:null},
        stroke:           { type:'color',
                            value:null},
        stroke_dasharray: { type:'string',
                            value:null},
        stroke_opacity:   { type:'number',
                            value:null},
        label:            { type:'string',
                            value:null},
        color:            { type:'color',
                            value:'black'}
      };
    
    this.listeners = {};
    this.datasetName = main_dataset_name;
  };
  
  function Symbol() {
    ElementBase.apply(this, arguments);
    
    this.attrs.shape =  { type:'symbol',
                          value:'circle'};
    this.attrs.size =   { type:'number',
                          value:null};
  };
  
  function Line() {
    ElementBase.apply(this, arguments);
    this.attrs.fill.value = 'none';
    
    this.attrs.interpolation =  { type:'string',
                                  value:'linear'};
    this.attrs.stroke_linecap = { type:'string',
                                  value:null};
  };
  
  function Bar() {
    ElementBase.apply(this, arguments);
    
    // No specific attributes
  };
  
  function BoxPlot() {
    ElementBase.apply(this, arguments);
    this.attrs.fill.value = 'none';
    
    // No specific attributes
  };
  
  ////////////////////////
  // Coordinate Systems //
  ////////////////////////
  
  main_object.rect = function(param) {
    return new Rect(param);
  };
  
  main_object.polar = function(param) {
    return new Polar(param);
  };
  
  // General construtor
  function CoordSys(param, funcName) {
    this.g = null;
    this.dimAlias = {};
    this.scale = {};
    this.boundary = {};
    for(var i = 0 ; i < this.dimName.length ; i++) {
      this.dimAlias[this.dimName[i]] = undefined;
      this.scale[this.dimName[i]] = null;
    }
    
    this.subSys = null;
    this.supSys = null;
    
    if(isUndefined(param)) {
      return;
    }
    
    for(var i in this.dimAlias) {
      var type = typeof param[i];
      if(type != 'undefined') {
        if(type != 'number' && type != 'string' && param[i] != null) {
          ERROR(errorParamMessage(funcName, i, type, '\'number\' or \'string\''));
        }
        else {
          this.dimAlias[i] = param[i];
        }
      }
    }
    
    if(isDefined(param.subSys) && !(param.subSys instanceof Rect) && !(param.subSys instanceof Polar)) {
      ERROR(errorParamMessage(funcName, 'subSys', typeof param.subSys, '\'Rect\' or \'Polar\''));
    }
    else {
      this.subSys = param.subSys;
    }
  }
  
  /////// CARTESIAN ///////
  function Rect(param) {
    CoordSys.call(this, param, lib_name+'.rect');
  };
  
  Rect.prototype.dimName = ['x', 'y'];
    
  Rect.prototype.computeScale = function(dim, width, height) {
    var size = {x:width,
                y:height};
    var subSize = {};
    var ranges = {x:[0, width],
                  y:[height, 0]};
    
    
    for(var i in this.dimAlias) {
      if(this.dimAlias[i] == null) {
        if(this.g.merge_null_axis) {
          subSize[i] = size[i];
        }
        else {
          subSize[i] = size[i] / (1+this.g.coordSysMargin);
        }
      }
      else if(this.subSys != null) {
        this.scale[i] = d3.scale.ordinal()
                        .domain(dim[this.dimAlias[i]].domain)
                        .rangeRoundBands(ranges[i], this.g.coordSysMargin);
        subSize[i] = this.scale[i].rangeBand();
      }
      else if(dim[this.dimAlias[i]].discret) {
        this.scale[i] = d3.scale.ordinal()
                        .domain(dim[this.dimAlias[i]].domain)
                        .rangePoints(ranges[i], this.g.ordinal_scale_padding);
        subSize[i] = Math.abs(ranges[i][0] - ranges[i][1]) / (dim[this.dimAlias[i]].domain.length - 1 + this.g.ordinal_scale_padding);
      }
      else {
        this.scale[i] = d3.scale.linear()
                        .domain(addPadding(dim[this.dimAlias[i]].domain, this.g.linear_scale_padding))
                        .range(ranges[i])
                        .nice();
        subSize[i] = size[i] / (this.scale[i].domain()[1] - this.scale[i].domain()[0]);
      }
      
      if(this.dimAlias[i] != null) {
        dim[this.dimAlias[i]].band = subSize[i];
      }
      
      this.boundary[i] = {min:0, max:size[i]};
    }
    
    
    // Sub coordinate system scale
    if(this.subSys != null) {
      this.subSys.computeScale(dim, subSize['x'], subSize['y']);
    }
  };
    
  Rect.prototype.getX = function(pos, d, i) {
    if(this.dimAlias['x'] == null ||
       pos[this.dimAlias['x']] == null) {
      return 0;
    }
    else {
      return this.scale['x'](pos[this.dimAlias['x']](d, i));
    }
  };
  
  Rect.prototype.getY = function(pos, d, i) {
    var Y = null;
    if(this.dimAlias['y'] == null ||
       pos[this.dimAlias['y']] == null) {
      return 0;
    }
    else {
      return this.scale['y'](pos[this.dimAlias['y']](d, i));
    }
  };
  
  Rect.prototype.getXOrigin = function(pos, d, i) {
    return 0;
  };
  
  Rect.prototype.getYOrigin = function(pos, d, i) {
    return 0;
  };
  
  Rect.prototype.updateSVG = function(svg, dim, width, height, depth) {
    /*                 *\
     * Draw background *
    \*                 */
    if(this.g.drawBackground) {
      var bg = svg.select('g.background');
      if(bg.empty()) {
        bg = svg.append('g')
          .attr('class', 'background')
            .append('rect')
              .attr('width', width)
              .attr('height', height)
              .attr('fill', 'orange');
        
        if(this.g.transition_duration > 0) {
          bg = bg.attr('fill-opacity', 0)
                .transition().duration(this.g.transition_duration);
        }
        bg.attr('fill-opacity', 0.3);
      }
      else {
        bg = bg.select('rect');
        if(this.g.transition_duration > 0) {
          bg = bg.transition().duration(this.g.transition_duration);
        }
        bg.attr('width', width)
          .attr('height', height);
      }
    }
    
    /*             *\
     * Draw Axises *
    \*             */
    var dimInfo = [
                    { dimName:'x',
                      orient:'bottom',
                      offsetY:height
                    },
                    { dimName:'y',
                      orient:'left',
                      offsetY:0
                    }
                  ];
    
    for(var i = 0 ; i < dimInfo.length ; i++) {
      var dimName = dimInfo[i].dimName;
      var scale;
      var axisDim;
      
      if(this.g.merge_null_axis) {
        // This axis has already been drawn by a sup coordinate system
        if(this.supSys != null &&
           // this.supSys instanceof Rect && // always true
           (this.supSys.dimAlias['x'] == null ||
            this.supSys.dimAlias['y'] == null)) {
          scale = null;
          axisDim = null;
        }
        else {
          var coordSys = this;
          while(coordSys != null &&
                coordSys instanceof Rect &&
                coordSys.dimAlias[dimName] == null) {
            coordSys = coordSys.subSys;
          }
          if(coordSys instanceof Rect) {
            scale = coordSys.scale[dimName];
            axisDim = coordSys.dimAlias[dimName];
          }
          else {
            scale = null;
            axisDim = null;
          }
        }
      }
      else if(this.dimAlias[dimName] != null) {
        scale = this.scale[dimName];
        axisDim = this.dimAlias[dimName];
      }
      else {
        scale = null;
        axisDim = null;
      }
      
      if(scale != null) {
        var axisNode = svg.select('g.axis.'+axisDim);
        var axis = d3.svg.axis().scale(scale).orient(dimInfo[i].orient);
        
        if(!dim[axisDim].discret) {
          axis.ticks(5);
        }
        
        // On enter
        if(axisNode.empty()) {
          axisNode = svg.append('g')
                      .attr('class', 'axis '+axisDim)
                      .classed(dimName, true)
                      .attr('transform', 'translate(0,'+dimInfo[i].offsetY+')');
        
          if(this.g.transition_duration > 0 && false) {
            axisNode.attr('fill-opacity', 0)
                    .attr('stroke-opacity', 0)
                  .transition().duration(this.g.transition_duration)
                    .attr('fill-opacity', 1)
                    .attr('stroke-opacity', 1);
          }
          
          axisNode.call(axis);
          
          if(!dim[axisDim].displayAxis) {
            axisNode.select('.domain').remove();
          }
          if(!dim[axisDim].displayTicks) {
            axisNode.selectAll('.tick').remove();
          }
        }
        // On update
        else {
          if(this.g.transition_duration > 0) {
            axisNode = axisNode.transition().duration(this.g.transition_duration);
          }
          axisNode.attr('transform', 'translate(0,'+dimInfo[i].offsetY+')')
                  .call(axis);
          
          if(!dim[axisDim].displayAxis) {
            axisNode.select('.domain').remove();
          }
          if(!dim[axisDim].displayTicks) {
            axisNode.selectAll('.tick').transition().duration(0).remove();
          }
        }
      }
    }
    
    /*                                       *\
     * Generate svg of sub coordinate system *
    \*                                       */
    if(this.subSys != null) {
      var infoSubCoordSys = [];
      var rangeX = (this.dimAlias['x'] != null) ? this.scale['x'].range() : 
                    this.g.merge_null_axis      ? [0]
                                                : [width * (1 - 1 / (1+this.g.coordSysMargin)) / 2];
      
      var rangeY = (this.dimAlias['y'] != null) ? this.scale['y'].range() :
                    this.g.merge_null_axis      ? [0]
                                                : [height * (1 - 1 / (1+this.g.coordSysMargin)) / 2];
      
      var subWidth = (this.dimAlias['x'] != null) ? this.scale['x'].rangeBand() :
                      this.g.merge_null_axis      ? width
                                                  : width / (1+this.g.coordSysMargin);
      
      var subHeight = (this.dimAlias['y'] != null)  ? this.scale['y'].rangeBand() :
                      this.g.merge_null_axis        ? height
                                                    : height / (1+this.g.coordSysMargin);
      
      for(var i = 0 ; i < rangeX.length ; i++) {
        for(var j = 0 ; j < rangeY.length ; j++) {
          infoSubCoordSys.push([i, j, rangeX[i], rangeY[j]]);
        }
      }
      
      var subCoordSysNode = svg.selectAll('g.depth'+(depth+1))
                              .data(infoSubCoordSys);
      
      // On update
      subCoordSysNode.attr('class', function(d){;return 'depth'+(depth+1)+' sub-graphic-'+d[0]+'-'+d[1];});
      (this.g.transition_duration > 0
      ? subCoordSysNode.transition().duration(this.g.transition_duration)
      : subCoordSysNode)
        .attr('transform', function(d){return 'translate('+d[2]+','+d[3]+')';});
      
      // On enter
      subCoordSysNode.enter()
        .append('g')
          .attr('class', function(d){;return 'depth'+(depth+1)+' sub-graphic-'+d[0]+'-'+d[1];})
          .attr('transform', function(d){return 'translate('+d[2]+','+d[3]+')';});
      
      // On exit
      subCoordSysNode.exit().remove();
      
      var subSys = this.subSys;
      subCoordSysNode.each(function(d) {
        subSys.updateSVG(d3.select(this), dim, subWidth, subHeight, depth+1);
      });
    }
  };
  
  
  /////// POLAR ///////
  function Polar(param) {
    CoordSys.call(this, param, lib_name+'.polar');
    
    this.centerX = null;
    this.centerY = null;
  };
  
  Polar.prototype.dimName = ['theta', 'radius'];
  
  Polar.prototype.computeScale = function(dim, width, height) {
    this.centerX = width / 2;
    this.centerY = height / 2;
    
    
    // Theta
    this.boundary['theta'] = {min:0, max:2*Math.PI};
    if(this.dimAlias['theta'] == null) {
    }
    else if(dim[this.dimAlias['theta']].discret) {
      var dom = dim[this.dimAlias['theta']].domain.slice();
      dom.push('');
      this.scale['theta'] = d3.scale.ordinal()
                      .domain(dom)
                      .rangePoints([0, 2 * Math.PI]);
      dim[this.dimAlias['theta']].band = (2 * Math.PI) / dim[this.dimAlias['theta']].domain.length;
    }
    else {
      this.scale['theta'] = d3.scale.linear()
                                    .domain(dim[this.dimAlias['theta']].domain)
                                    .range([0, 2*Math.PI]);
      dim[this.dimAlias['theta']].band = 2 * Math.PI / (this.scale['theta'].domain()[1] - this.scale['theta'].domain()[0]);
    }
    
    
    // Radius
    this.boundary['radius'] = {min:0, max:d3.min([width / 2, height / 2])};
    if(this.dimAlias['radius'] == null) {
    }
    else if(dim[this.dimAlias['radius']].discret) {
      this.scale['radius'] = d3.scale.ordinal()
                               .domain(dim[this.dimAlias['radius']].domain)
                               .rangePoints([0, this.boundary['radius'].max], 1);
      dim[this.dimAlias['radius']].band = this.boundary['radius'].max / dim[this.dimAlias['radius']].domain.length;
    }
    else {
      this.scale['radius'] = d3.scale.linear()
                      .domain(dim[this.dimAlias['radius']].domain)
                      .range([0, this.boundary['radius'].max])
                      .nice();
      dim[this.dimAlias['radius']].band = this.boundary['radius'].max / (this.scale['radius'].domain()[1] - this.scale['radius'].domain()[0]);
    }
  };
  
  Polar.prototype.getX = function(pos, d, i) {
    var theta = null;
    if(this.dimAlias['theta'] != null) {
      if(pos[this.dimAlias['theta']] != null) {
        theta = this.scale['theta'](pos[this.dimAlias['theta']](d, i))
      }
      else {
        theta = 0;
      }
    }
    else {
      theta = this.boundary['theta'].max / 2;
    }
    
    
    var radius = null;
    if(this.dimAlias['radius'] != null) {
      if(pos[this.dimAlias['radius']] != null) {
        radius = this.scale['radius'](pos[this.dimAlias['radius']](d, i))
      }
      else {
        radius = 0;
      }
    }
    else {
      radius = this.boundary['radius'].max / 2;
    }
    
    return this.centerX + Math.cos(theta) * radius;
  };
  
  Polar.prototype.getY = function(pos, d, i) {
    var theta = null;
    if(this.dimAlias['theta'] != null) {
      if(pos[this.dimAlias['theta']] != null) {
        theta = this.scale['theta'](pos[this.dimAlias['theta']](d, i))
      }
      else {
        theta = 0;
      }
    }
    else {
      theta = this.boundary['theta'].max / 2;
    }
    
    var radius = null;
    if(this.dimAlias['radius'] != null) {
      if(pos[this.dimAlias['radius']] != null) {
        radius = this.scale['radius'](pos[this.dimAlias['radius']](d, i))
      }
      else {
        radius = 0;
      }
    }
    else {
      radius = radius = this.boundary['radius'].max / 2;;
    }
    
    return this.centerY - Math.sin(theta) * radius;
  };
  
  Polar.prototype.getXOrigin = function(pos, d, i) {
    return this.centerX;
  }
  
  Polar.prototype.getYOrigin = function(pos, d, i) {
    return this.centerY;
  }
  
  Polar.prototype.updateSVG = function(svg, dim, width, height, depth) {
    var maxRadius = this.boundary['radius'].max;
    
    /*                 *\
     * Draw background *
    \*                 */
    if(this.g.drawBackground) {
      var bg = svg.select('g.background');
      if(bg.empty()) {
        bg = svg.append('g')
          .attr('class', 'background')
            .append('circle')
              .attr('transform', 'translate('+this.centerX+','+this.centerY+')')
              .attr('r', maxRadius)
              .attr('fill', 'orange');
              
        if(this.g.transition_duration > 0) {
          bg = bg.attr('fill-opacity', 0)
                .transition().duration(this.g.transition_duration);
        }
        bg.attr('fill-opacity', 0.3);
      }
      else {
        bg = bg.select('circle');
        if(this.g.transition_duration > 0) {
          bg = bg.transition().duration(this.g.transition_duration);
        }
        bg.attr('transform', 'translate('+this.centerX+','+this.centerY+')')
          .attr('r', maxRadius);
      }
    }
    
    
    /*             *\
     * Draw Axises *
    \*             */
    
    // Radius 'axis'
    if(this.dimAlias['radius'] != null) {
      var axisNode = svg.select('g.axis.'+this.dimAlias['radius']);
      var ticks;
      
      if(dim[this.dimAlias['radius']].discret) {
        ticks = this.scale['radius'].domain();
      }
      else {
        ticks = this.scale['radius'].ticks(5);
        var dom = this.scale['radius'].domain();
        ticks.push(dom[0]);
        ticks.push(dom[1]);
        RemoveDupArray(ticks);
      }
      
      if(axisNode.empty()) {
        axisNode = svg.append('g')
                    .attr('class', 'axis '+this.dimAlias['radius'])
                    .classed('radius', true)
                    .attr('transform', 'translate(' +this.centerX+ ','+this.centerY+')');
        
        if(this.g.transition_duration > 0) {
          axisNode.attr('fill-opacity', 0)
                  .attr('stroke-opacity', 0)
                .transition().duration(this.g.transition_duration)
                  .attr('fill-opacity', 1)
                  .attr('stroke-opacity', 1);
        }
      }
      else {
        (this.g.transition_duration > 0
        ? axisNode.transition().duration(this.g.transition_duration)
        : axisNode)
        .attr('transform', 'translate(' +this.centerX+ ','+this.centerY+')');
      }
      
      
      var ticksInfo = [];
      for(var i = 0 ; i < ticks.length ; i++) {
        ticksInfo.push([ticks[i], this.scale['radius'](ticks[i])]);
      }
      
      var tickNode = axisNode.selectAll('.tick')
                            .data(ticksInfo);
      
      // On update
      (this.g.transition_duration > 0
      ? tickNode.select('circle').transition().duration(this.g.transition_duration)
      : tickNode.select('circle'))
        .attr('r', function(d){return d[1] || 0.5;});
      (this.g.transition_duration > 0
      ? tickNode.select('text').transition().duration(this.g.transition_duration)
      : tickNode.select('text'))
        .text(function(d){return d[0];})
        .attr('x', function(d){return d[1] + 5;});
      
      // On exit
      tickNode.exit().remove();
      
      // On enter
      tickNode = tickNode.enter()
                      .append('g')
                      .attr('class', 'tick');
      if(dim[this.dimAlias['radius']].displayAxis) {
        tickNode.append('circle')
                  .attr('r', function(d){return d[1] || 0.5;})
                  .attr('fill', 'none')
                  .attr('stroke', 'black');
      }
      
      if(dim[this.dimAlias['radius']].displayTicks) {
        tickNode.append('text')
                .text(function(d){return d[0];})
                .attr('x', function(d){return d[1] + 5;})
                .attr('y', -5)
                .attr('fill', 'black');
      }
    }
    
    // Theta axis
    if(this.dimAlias['theta'] != null) {
      var axisNode = svg.select('g.axis.'+this.dimAlias['theta']);
      var ticks;
      
      if(dim[this.dimAlias['theta']].discret) {
        ticks = this.scale['theta'].domain();
      }
      else {
        ticks = this.scale['theta'].ticks(8);
        var dom = this.scale['theta'].domain();
        //ticks.push(dom[0]);
        //ticks.push(dom[1]);
        //RemoveDupArray(ticks);
      }
      
      if(axisNode.empty()) {
        axisNode = svg.append('g')
                    .attr('class', 'axis '+this.dimAlias['theta'])
                    .classed('theta', true)
                    .attr('transform', 'translate(' +this.centerX+ ','+this.centerY+')');
        
        if(this.g.transition_duration > 0) {
          axisNode.attr('fill-opacity', 0)
                  .attr('stroke-opacity', 0)
                .transition().duration(this.g.transition_duration)
                  .attr('fill-opacity', 1)
                  .attr('stroke-opacity', 1);
        }
      }
      else {
        (this.g.transition_duration > 0
        ? axisNode.transition().duration(this.g.transition_duration)
        : axisNode)
        .attr('transform', 'translate(' +this.centerX+ ','+this.centerY+')');
      }
      
      var ticksInfo = [];
      for(var i = 0 ; i < ticks.length ; i++) {
        ticksInfo.push([ticks[i], this.scale['theta'](ticks[i])]);
      }
      
      var tickNode = axisNode.selectAll('.tick')
                            .data(ticksInfo);
      
      // On update
      (this.g.transition_duration > 0
      ? tickNode.select('line').transition().duration(this.g.transition_duration)
      : tickNode.select('line'))
        .attr('x2', function(d){return Math.cos(d[1]) * maxRadius;})
        .attr('y2', function(d){return -Math.sin(d[1]) * maxRadius;});
      (this.g.transition_duration > 0
      ? tickNode.select('text').transition().duration(this.g.transition_duration)
      : tickNode.select('text'))
        .text(function(d){return (typeof d[0] === 'number') ? d[0].toFixed(2) : d[0].toString();})
        .attr('transform', function(d) {
          var x = Math.cos(d[1]) * (maxRadius + 15);
          var y = -Math.sin(d[1]) * (maxRadius + 15);
          return 'translate('+x+','+y+')';
        });
      
      // On exit
      tickNode.exit().remove();
      
      // On enter
      tickNode = tickNode.enter()
                      .append('g')
                      .attr('class', 'tick');
      if(dim[this.dimAlias['theta']].displayAxis) {
        tickNode.append('line')
                  .attr('x1', 0)
                  .attr('y1', 0)
                  .attr('x2', function(d){return Math.cos(d[1]) * maxRadius;})
                  .attr('y2', function(d){return -Math.sin(d[1]) * maxRadius;})
                  .attr('stroke', 'black');
      }
      
      if(dim[this.dimAlias['theta']].displayTicks) {
        tickNode.append('text')
                .text(function(d){return (typeof d[0] === 'number') ? d[0].toFixed(2) : d[0].toString();})
                .attr('transform', function(d) {
                  var x = Math.cos(d[1]) * (maxRadius + 15);
                  var y = -Math.sin(d[1]) * (maxRadius + 15);
                  return 'translate('+x+','+y+')';
                })
                .attr('text-anchor', 'middle')
                .attr('y', '.35em')
                .attr('fill', 'black');
      }
    }
  }
  
  ///////////////////////
  // Loading functions //
  ///////////////////////
  
    // Data loader
  function DataLoader() {
    this.g = null;
    this.sendXhrRequest = null;
    var self = this;
    
    this.load = function(error, dataset) {
      if(error != null) {
        ERROR(''+error.status+': '+error.statusText+'\n'+error.responseText);
      }
      
      self.g.onDataLoaded(dataset);
    };
  }

  // Load data from a csv file
  main_object.loadFromFile = function(param) {
    var funcName = lib_name+'.loadFromFile';
    var filename = checkParam(funcName, param, 'file');
    
    var dl = new DataLoader();
    
    var xhr = d3.text(filename)
                .on('progress', getProgressListener(dl))
                .response(function(request) {
                  TIMER_END('Loading CSV file', dl.g.display_timers);
                  TIMER_BEGIN('Parsing CSV', dl.g.display_timers);
                  var data = d3.csv.parse(request.responseText, processRow);
                  TIMER_END('Parsing CSV', dl.g.display_timers);
                  return data;
                });
    
    dl.sendXhrRequest = function() {
      TIMER_BEGIN('Loading CSV file', dl.g.display_timers);
      xhr.get(dl.load);
    }
    
    return dl;
  };
  
  // Load data from a database
  main_object.loadFromDatabase = function(param) {
    var funcName = lib_name+'.loadFromDatabase';
    var host =    checkParam(funcName, param, 'host', 'localhost');
    var dbname =  checkParam(funcName, param, 'dbname');
    var user =    checkParam(funcName, param, 'user');
    var pwd =     checkParam(funcName, param, 'pwd');
    var request = checkParam(funcName, param, 'request');
    
    
    var dl = new DataLoader();
    
    var httpRequestParam = 'host='+host+'&dbname='+dbname+'&user='+user+'&pwd='+pwd+'&request='+request;
    
    var xhr = d3.xhr('http://localhost')
                .header('Content-Type', 'application/x-www-form-urlencoded')
                .on('progress', getProgressListener(dl))
                .response(function(request) {
                  TIMER_END('Loading CSV from database', dl.g.display_timers);
                  TIMER_BEGIN('Parsing CSV', dl.g.display_timers);
                  var data = d3.csv.parse(request.responseText, processRow);
                  TIMER_END('Parsing CSV', dl.g.display_timers);
                  return data;
                });
    
    dl.sendXhrRequest = function() {
      TIMER_BEGIN('Loading CSV from database', dl.g.display_timers);
      xhr.post(httpRequestParam, dl.load);
    }
    
    return dl;
  };
  
  
  ///////////////////////////////
  // Data processing functions //
  ///////////////////////////////

  // Filter data
  main_object.filter = function(param) {
    var funcName = lib_name+'.filter';
    var criteria = checkParam(funcName, param, 'criteria');
    
    // data = {oldData, newData, oldProcessedData}
    return function(data) {
      var newData = data.newData;
      var filtered_data = [];
      
      // We only filter new data (old ones already are filtered)
      for(var i = 0 ; i < newData.length ; i++) {
        if(criteria(newData[i], i)) {
          filtered_data.push(newData[i]);
        }
      }
      
      return {oldData:data.oldProcessedData, newData:filtered_data};
    }
  }
  
  // Aggregate data
  main_object.groupBy = function(param) {
    var funcName = lib_name+'.groupBy';
    var group_by = param;
    var groupByAes = {};
    
    // True:  aggregate from the whole data (old + new)
    // False: aggregate only from new data
    var recomputeWholeGroup = false;
    var getNewData = function(groupedData) {
      var new_data = [];
      for(var i = 0 ; i < groupedData.length ; i++) {
        if(groupedData[i].length > 0) {
          var datum = {};
          for(var j in group_by) {
            datum[j] = groupByAes[j].func(groupedData[i][0], 0);
          }
          new_data.push(datum);
        }
      }
      return new_data;
    };
    
    // Aesthetics
    var aes = [];
    // Map data column name -> aesthetic id
    var dataCol2Aes = {};
    // Map function -> aesthetic id
    var func2Aes = {};
    // Map const value -> aesthetic id
    var const2Aes = {};
    
    for(var i in group_by) {
      var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, group_by[i], main_dataset_name, 'group_by:'+i, funcName);
      groupByAes[i] = aes[aesId];
    }
    
    // GroupBy
    // data = {oldData, newData, oldProcessedData}
    var groupByFunction = function(data) {
      var groupedData = [];
      var splitSizes = [];
      
      if(recomputeWholeGroup) {
        // We recompute the whole thing
        data = data.oldData.concat(data.newData);
        
        for(var i in group_by) {
          computeDomain(groupByAes[i], data, 'discret');
          splitSizes.push(groupByAes[i].discretDomain.length);
        }
        
        var nestedata = allocateSplitDataArray(splitSizes, 0);
        for(var i = 0 ; i < data.length ; i++) {
          var dataSubset = nestedata;
          
          for(var j in group_by) {
            var value = groupByAes[j].func(data[i], i);
            var id = groupByAes[j].discretDomain.indexOf(value);
            dataSubset = dataSubset[id];
          }
          
          dataSubset.push(data[i]);
        }
        
        var it = new HierarchyIterator(nestedata);
        while(it.hasNext()) {
          var dataSubset = it.next();
          if(dataSubset.length > 0) {
            groupedData.push(dataSubset);
          }
        }
      }
      else {
        var newData = data.newData;
        var oldData = data.oldProcessedData;
        
        for(var i in group_by) {
          computeDomain(groupByAes[i], newData, 'discret');
          for(var j = 0 ; j < oldData.length ; j++) {
            groupByAes[i].discretDomain.push(oldData[j][i]);
          }
          RemoveDupArray(groupByAes[i].discretDomain);
          splitSizes.push(groupByAes[i].discretDomain.length);
        }
        
        var nesteNewData = allocateSplitDataArray(splitSizes, 0);
        for(var i = 0 ; i < newData.length ; i++) {
          var dataSubset = nesteNewData;
          
          for(var j in group_by) {
            var value = groupByAes[j].func(newData[i], i);
            var id = groupByAes[j].discretDomain.indexOf(value);
            dataSubset = dataSubset[id];
          }
          
          dataSubset.push(newData[i]);
        }
        
        var nesteOldData = allocateSplitDataArray(splitSizes, 0);
        for(var i = 0 ; i < oldData.length ; i++) {
          var dataSubset = nesteOldData;
          
          for(var j in group_by) {
            var value = groupByAes[j].func(oldData[i], i);
            var id = groupByAes[j].discretDomain.indexOf(value);
            dataSubset = dataSubset[id];
          }
          
          dataSubset.push(oldData[i]);
        }
        
        var itNew = new HierarchyIterator(nesteNewData);
        var itOld = new HierarchyIterator(nesteOldData);
        while(itNew.hasNext()) {
          var newDataSubset = itNew.next();
          var oldDataSubset = itOld.next();
          
          if(newDataSubset.length > 0 || oldDataSubset.length > 0) {
            groupedData.push({oldData:oldDataSubset, newData:newDataSubset});
          }
        }
      }
      
      return {oldData:[], newData:getNewData(groupedData)};
    };
    
    // Count
    groupByFunction.count = function() {
      recomputeWholeGroup = false;
      getNewData = function(groupedData) {
        var new_data = [];
        for(var i = 0 ; i < groupedData.length ; i++) {
          var oldCount = 0;
          if(groupedData[i].oldData.length > 0) {
            oldCount = groupedData[i].oldData[0][sum_attr_name];
            datum = groupedData[i].oldData[0];
          }
          else {
            for(var j in group_by) {
              datum[j] = groupByAes[j].func(groupedData[i].newData[0], 0);
            }
          }
          
          datum.count = oldCount + groupedData[i].newData.length;
          new_data.push(datum);
        }
        return new_data;
      };
      
      return groupByFunction;
    };
    
    // Proportion
    groupByFunction.proportion = function(param) {
      funcName += '().proportion';
      var weight =    checkParam(funcName, param, 'weight', 1);
      var aggreg_on = {};
      
      for(var i in param) {
        if(i != 'weight') {
          aggreg_on[i] = param[i];
        }
      }
      
      var aggregOnAes = {};
      for(var i in aggreg_on) {
        var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, aggreg_on[i], main_dataset_name, i, funcName);
        aggregOnAes[i] = aes[aesId];
      }
      
      var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, weight, main_dataset_name, 'weight', funcName);
      var weightFunc = aes[aesId].func;
      
      recomputeWholeGroup = true;
      getNewData = function(groupedData) {
        var new_data = [];
        checkAesType('number', typeof weightFunc(groupedData[0][0], 0), 'weight', funcName);
        var data = d3.merge(groupedData);
        var splitSizes = [];
        for(var i in aggreg_on) {
          computeDomain(aggregOnAes[i], data, 'discret');
          splitSizes.push(aggregOnAes[i].discretDomain.length);
        }
        
        for(var i = 0 ; i < groupedData.length ; i++) {
          var nestedata = allocateSplitDataArray(splitSizes, 0);
          
          for(var j = 0 ; j < groupedData[i].length ; j++) {
            var dataSubset = nestedata;
            
            for(var k in aggreg_on) {
              var value = aggregOnAes[k].func(groupedData[i][j], j);
              var id = aggregOnAes[k].discretDomain.indexOf(value);
              dataSubset = dataSubset[id];
            }
            
            dataSubset.push(groupedData[i][j]);
          }
          
          var total = 0;
          var counts = [];
          var it = new HierarchyIterator(nestedata);
          var j = 0;
          while(it.hasNext()) {
            dataSubset = it.next();
            if(dataSubset.length > 0) {
              counts[j] = 0;
              for(var k = 0 ; k < dataSubset.length ; k++) {
                counts[j] += weightFunc(dataSubset[k], k);
              }
              
              total += counts[j];
              j++;
            }
          }
          
          it = new HierarchyIterator(nestedata);
          j = 0;
          while(it.hasNext()) {
            dataSubset = it.next();
            if(dataSubset.length > 0) {
              var datum = {};
              
              for(var k in group_by) {
                datum[k] = groupByAes[k].func(dataSubset[0], 0);
              }
              for(var k in aggreg_on) {
                datum[k] = aggregOnAes[k].func(dataSubset[0], 0);
              }
              
              datum.proportion = counts[j] / total;
              new_data.push(datum);
              j++;
            }
          }
        }
        
        return new_data;
      };
      
      return groupByFunction;
    };
    
    //Sum
    groupByFunction.sum = function(param) {
      funcName += '().sum';
      var sum_attr_name = null;
      var sum_attr_func = null;
      
      for(var i in param) {
        if(sum_attr_name == null) {
          sum_attr_name = i;
          sum_attr_func = aes[getAesId(aes, dataCol2Aes, func2Aes, const2Aes, param[i], main_dataset_name, i, funcName)].func;
        }
        else {
          WARNING('More than 1 parameter passed to '+funcName+': '+i+' ignored');
        }
      }
      
      if(sum_attr_name == null) {
        sum_attr_name = 'sum';
        sum_attr_func = function(){return 1;};
      }
      
      recomputeWholeGroup = false;
      getNewData = function(groupedData) {
        var i = 0;
        while(groupedData[0].newData.length == 0) {
          i++;
        }
        checkAesType('number', typeof sum_attr_func(groupedData[i].newData[0], 0), sum_attr_name, funcName);
        
        var new_data = [];
        
        for(var i = 0 ; i < groupedData.length ; i++) {
          var sum = 0;
          var datum = {};
          if(groupedData[i].oldData.length > 0) {
            sum = groupedData[i].oldData[0][sum_attr_name];
            datum = groupedData[i].oldData[0];
          }
          else {
            for(var j in group_by) {
              datum[j] = groupByAes[j].func(groupedData[i].newData[0], 0);
            }
          }
          
          for(var j = 0 ; j < groupedData[i].newData.length ; j++) {
            sum += sum_attr_func(groupedData[i].newData[j], j);
          }
          
          datum[sum_attr_name] = sum;
          new_data.push(datum);
        }
        return new_data;
      };
      
      return groupByFunction;
    };
    
    
    return groupByFunction;
  };
  
  // Sort data
  main_object.sort = function(param) {
    var funcName = lib_name+'.sort';
    var compare = checkParam(funcName, param, 'comparator');
    
    // data = {oldData, newData, oldProcessedData}
    return function(data) {
      var newData = data.newData;
      var oldData = data.oldProcessedData;
      var sorted_new_data = new Array(newData.length);
      
      for(var i = 0 ; i < newData.length ; i++) {
        sorted_new_data[i] = newData[i];
      }
      
      sorted_new_data.sort(compare);
      
      // Merge new and old data (both sorted)
      var sorted_data = new Array(oldData.length, newData.length);
      var i = 0;
      var j = 0;
      var k = 0;
      while(i < oldData.length && j < sorted_new_data.length) {
        // oldData[i] < newData[j]
        if(compare(oldData[i], sorted_new_data[j]) < 0) {
          sorted_data[k] = oldData[i];
          i++;
        }
        else {
          sorted_data[k] = sorted_new_data[j];
          j++;
        }
        k++;
      }
      
      while(i < oldData.length) {
        sorted_data[k] = oldData[i];
        i++;
        k++;
      }
      while(j < sorted_new_data.length) {
        sorted_data[k] = sorted_new_data[j];
        j++;
        k++;
      }
      
      return {oldData:[], newData:sorted_data};
    }
  };
  main_object.compare = function(a, b) {
    if(typeof a === 'number') {
      if(typeof b === 'number') {
        return a - b;
      }
      else {
        return -1;
      }
    }
    else {
      if(typeof b === 'number') {
        return 1;
      }
      else {
        for (var i=0,n=Math.max(a.length, b.length); i<n && a.charAt(i) === b.charAt(i); ++i);
        if (i === n) {
          return 0;
        }
        return a.charAt(i) > b.charAt(i) ? 1 : -1;
      }
    }
  };
  
  
  // Melt data
  main_object.melt = function(param) {
    var funcName = lib_name+'.melt';
    var ids =           checkParam(funcName, param, 'ids',            null);
    var measures =      checkParam(funcName, param, 'measures',       null);
    var variable_name = checkParam(funcName, param, 'variable_name',  'variable');
    var value_name =    checkParam(funcName, param, 'value_name',     'value');
    
    if(ids == null && measures == null) {
      ERROR('In function '+funcName+', both parameters ids and measures are missing. You need to set at leat one of them');
    }
    
    // data = {oldData, newData, oldProcessedData}
    return function(data) {
      var newData = data.newData;
      var melted_data = [];
      
      if(ids == null) {
        ids = [];
        for(var field in newData[0]) {
          if(measures.indexOf(field) < 0) {
            ids.push(field);
          }
        }
      }
      else if(measures == null) {
        measures = [];
        for(var field in newData[0]) {
          if(ids.indexOf(field) < 0) {
            measures.push(field);
          }
        }
      }
      
      // We only melt new data (old ones already are melted)
      for(var i = 0 ; i < newData.length ; i++) {
        for(var j = 0 ; j < measures.length ; j++) {
          var datum = {};
          for(var k = 0 ; k < ids.length ; k++) {
            datum[ids[k]] = newData[i][ids[k]];
          }
          datum[variable_name] = measures[j];
          datum[value_name] = newData[i][measures[j]];
          // Cast into number if possible
          var value = +datum[value_name];
          if(!isNaN(value)) {
            datum[value_name] = value;
          }
          melted_data.push(datum);
        }
      }
      
      return {oldData:data.oldProcessedData, newData:melted_data};
    }
  }
  
  /////////////////////
  // Popup functions //
  /////////////////////
  
  // Display a popup
  main_object.showPopup = function(param) {
    var funcName = lib_name+'.showPopup';
    var g =         checkParam(funcName, param, 'graphic');
    var id =        checkParam(funcName, param, 'id');
    id = (id instanceof Array) ? id : [id];
    var position =  checkParam(funcName, param, 'position', [0, 0]);
    var text =      checkParam(funcName, param, 'text',     '');
    var duration =  checkParam(funcName, param, 'duration', 0);
    
    id.unshift('pop-up');
    var selector = '';
    for(var i = 0 ; i < id.length ; i++) {
      selector += '.'+id[i];
    }
    var popup = g.svg.select(selector);
    var bgNode = null;
    var textNode = null;
    
    if(popup.empty()) {
      popup = g.svg.insert('g').style('pointer-events', 'none');
      for(var i = 0 ; i < id.length ; i++) {
        popup.classed(id[i].toString(), true);
      }
      bgNode = popup.insert('rect').attr('x', '0')
                                   .attr('y', '0')
                                   .attr('rx', '5')
                                   .attr('ry', '5')
                                   .attr('fill', 'white')
      textNode = popup.insert('text').attr('x', '10')
                                     .attr('y', '20');
    }
    else {
      bgNode = popup.select('rect');
      textNode = popup.select('text');
    }
    
    // Set position, text and size
    popup.attr('transform', 'translate('+position[0]+','+position[1]+')');
    textNode.attr('opacity', '0')
            .text(text);
    var textDOM = textNode.node();
    bgNode.attr('opacity', '0')
          .attr('width', textDOM.clientWidth + 20)
          .attr('height', textDOM.clientHeight + 15);
    
    // Show the popup
    bgNode.interrupt().transition().duration(duration).attr('opacity', '0.7');
    textNode.interrupt().transition().duration(duration).attr('opacity', '1');
  };
  
  // Hide a pop-up
  main_object.hidePopup = function(param) {
    var funcName = lib_name+'.hidePopup';
    var g =         checkParam(funcName, param, 'graphic');
    var id =        checkParam(funcName, param, 'id');
    id = (id instanceof Array) ? id : [id];
    var duration =  checkParam(funcName, param, 'duration', 0);
    
    id.unshift('pop-up');
    var selector = '';
    for(var i = 0 ; i < id.length ; i++) {
      selector += '.'+id[i];
    }
    var popup = g.svg.select(selector);
    popup.select('rect').transition().duration(duration).attr('opacity', '0');
    popup.select('text').transition().duration(duration).attr('opacity', '0')
    // Callback at the end of the transition
      .each('end', function() {
          popup.remove();
        });
  };
  
  // Return if a pop-up exist with a  given id exist or not
  main_object.popupExist = function(param) {
    var funcName = lib_name+'.popupExist';
    var g =         checkParam(funcName, param, 'graphic');
    var id =        checkParam(funcName, param, 'id');
    id = (id instanceof Array) ? id : [id];
    
    id.unshift('pop-up');
    var selector = '';
    for(var i = 0 ; i < id.length ; i++) {
      selector += '.'+id[i];
    }
    return !g.svg.select(selector).empty();
  };
  
  
  ////////////////////
  // Event function //
  ////////////////////
  
  // Return the current event if any, null otherwise
  main_object.event = function() {
    return d3.event;
  };
  
  // Return the position of the mouse in the graphic
  // [0, 0] being the position of the top left corner
  main_object.mouse = function(g) {
    return d3.mouse(g.svg.node());
  };
  
  
  ///////////////////////////////
  // Special attributes setter //
  ///////////////////////////////
  
  function SpecialAttributeBase() {
    this.attrs = {};
  }
  
  // Interval
  
  main_object.interval = function(val1, val2) {
    return new Interval(val1, val2, false);
  };
  main_object.interval.stack = function(val, origin) {
    return new Interval(val, isUndefined(origin) ? 0 : origin, true);
  };
  
  function Interval(val1, val2, stacked) {
    SpecialAttributeBase.call(this);
    this.attrs.boundary1 = {value:val1};
    this.attrs.boundary2 = {value:val2};
    this.stacked = stacked;
  }
 
  
  
  // BoxPlot parameter
  main_object.boxplotBoxStat = function(param) {
    var funcName = lib_name+'.boxplotBoxStat';
    var q1 = checkParam(funcName, param, 'quartile1', data_binding_prefix+'quartile1');
    var q2 = checkParam(funcName, param, 'quartile2', data_binding_prefix+'quartile2');
    var q3 = checkParam(funcName, param, 'quartile3', data_binding_prefix+'quartile3');
    var w1  = checkParam(funcName, param, 'whisker1',  data_binding_prefix+'whisker1');
    var w2  = checkParam(funcName, param, 'whisker2',  data_binding_prefix+'whisker2');
    
    return new BoxPlotBoxStat(q1, q2, q3, w1, w2);
  };
  
  function BoxPlotBoxStat(q1, q2, q3, w1, w2) {
    SpecialAttributeBase.call(this);
    this.attrs.quartile1 = {value:q1};
    this.attrs.quartile2 = {value:q2};
    this.attrs.quartile3 = {value:q3};
    this.attrs.whisker1 = {value:w1};
    this.attrs.whisker2 = {value:w2};
  };
  
  main_object.boxplotStat = function(v) {
    return new BoxPlotStat(v);
  };
  
  function BoxPlotStat(v) {
    SpecialAttributeBase.call(this);
    this.attrs.value = v;
  };
  
  
  // Consider an aesthetic values as categorical values
  
  main_object.cat = function(value) {
    return new CategoricalValue(value);
  };
  
  function CategoricalValue(value) {
    SpecialAttributeBase.call(this);
    this.attrs.value = value;
  };
  
  
  ///////////////////////
  // Private functions //
  ///////////////////////
  
  // Add an element to the graphic
  var addElement = function(g, Type, param, originFunc) {
    var elt = new Type;
    
    // copying attributes' values from the fallback element
    for(var attr in g.fallback_element.attrs) {
      if(g.fallback_element.attrs[attr].value != null) {
        elt.attrs[attr] = { type:        g.fallback_element.attrs[attr].type,
                            value:       g.fallback_element.attrs[attr].value,
                            originFunc:  'Graphic.element'};
      }
    }
    for(var event in g.fallback_element.listeners) {
      elt.listeners[event] = g.fallback_element.listeners[event];
    }
    
    if(isDefined(param)) {
      for(var attr in param) {
        if(isDefined(elt.attrs[attr])) {
          elt.attrs[attr].value = param[attr];
        }
        else {
          elt.attrs[attr] = { type:'unknown',
                              value:param[attr]};
        }
        elt.attrs[attr].originFunc = originFunc;
      }
    }
    
    elt.datasetName = checkParam(originFunc, param, 'data', g.fallback_element.datasetName);
    
    g.elements.push(elt);
    g.lastElementAdded = elt;
  };
  
  // Set an svg attribute (each element have its value)
  var svgSetAttributePerElem = function(node, svgAttr, elt, attr) {
    if(isDefined(elt.attrs[attr])) {
      node.style(svgAttr, elt.attrs[attr].func);
    }
  };
  
  // Set common svg attribute (each element have its value)
  var svgSetCommonAttributesPerElem = function(node, elt) {
    svgSetAttributePerElem(node, 'stroke-width',     elt, 'stroke_width');
    svgSetAttributePerElem(node, 'stroke',           elt, 'stroke');
    svgSetAttributePerElem(node, 'stroke-dasharray', elt, 'stroke_dasharray');
    svgSetAttributePerElem(node, 'stroke-opacity',   elt, 'stroke_opacity');
    svgSetAttributePerElem(node, 'fill',             elt, 'fill');
    svgSetAttributePerElem(node, 'fill-opacity',     elt, 'fill_opacity');
  };
  
  // Set an svg attribute (element of the same group have the same value)
  var svgSetAttributePerGroup = function(node, svgAttr, elt, attr, datum, i) {
    if(isDefined(elt.attrs[attr])) {
      node.style(svgAttr, elt.attrs[attr].func(datum, i));
    }
  };
  
  // Set common svg attribute (element of the same group have the same value)
  var svgSetCommonAttributesPerGroup = function(node, elt, datum, i) {
    svgSetAttributePerGroup(node, 'stroke-width',     elt, 'stroke_width',     datum, i);
    svgSetAttributePerGroup(node, 'stroke',           elt, 'stroke',           datum, i);
    svgSetAttributePerGroup(node, 'stroke-dasharray', elt, 'stroke_dasharray', datum, i);
    svgSetAttributePerGroup(node, 'stroke-opacity',   elt, 'stroke_opacity',   datum, i);
    svgSetAttributePerGroup(node, 'fill',             elt, 'fill',             datum, i);
    svgSetAttributePerGroup(node, 'fill-opacity',     elt, 'fill_opacity',     datum, i);
  };
  
  // Draw a 'box' (Rectangle or Arc depending on the coordinate system)
  /*           |  Rect  |    Arcus    |
   * ----------+--------+-------------+
   * bound1    | x      | startAngle  |
   * bound2    | y      | innerRadius |
   * limBound1 | width  | endAngle    |
   * limBound2 | height | outerRadius |
   */
  var drawBox = function(node, deepestCoordSys, transition_duration, eltClass, getX, getY, bound1, bound2, limBound1, limBound2) {
    
    if(deepestCoordSys instanceof Rect) {
      // On enter
      var onEnter = node.enter().append('rect').attr('class', eltClass);
      onEnter.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
      onEnter.attr('x', bound1);
      onEnter.attr('y', bound2);
      onEnter.attr('width', limBound1);
      onEnter.attr('height', limBound2);
      
      // On update
      var onUpdate = null;
      if(transition_duration > 0) {
        onUpdate = node.transition().duration(transition_duration);
      }
      else {
        onUpdate = node;
      }
      onUpdate.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
      onUpdate.attr('x', bound1);
      onUpdate.attr('y', bound2);
      onUpdate.attr('width', limBound1);
      onUpdate.attr('height', limBound2);
      
      // On exit
      var onExit = node.exit();
      
      return {enter:onEnter, update:onUpdate, exit:onExit};
    }
    
    // Drawn arcus
    else if (deepestCoordSys instanceof Polar) {
      var arc = d3.svg.arc();
      
      bound1 = convertAngle.compose(bound1);
      limBound1 = convertAngle.compose(limBound1);
      
      // On enter
      var onEnter = node.enter().append('path').attr('class', eltClass);
      
      onEnter.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
      onEnter.attr('d', function(d, i){
          this._startAngle =  bound1(d, i);
          this._endAngle =    limBound1(d, i);
          this._innerRadius = bound2(d, i);
          this._outerRadius = limBound2(d, i);
          
          var datum = { startAngle:   this._startAngle,
                        endAngle:     this._endAngle,
                        innerRadius:  this._innerRadius,
                        outerRadius:  this._outerRadius};
            
          return arc(datum);
        });
      
      // On update
      var onUpdate = null;
      if(transition_duration > 0) {
        onUpdate = node.transition().duration(transition_duration);
        onUpdate.attrTween('d', function(d, i) {
          var startAngle =  bound1(d, i);
          var endAngle =    limBound1(d, i);
          var innerRadius = bound2(d, i);
          var outerRadius = limBound2(d, i);
          
          var interpolStartAngle =  d3.interpolate(this._startAngle,  startAngle);
          var interpolEndAngle =    d3.interpolate(this._endAngle,    endAngle);
          var interpolInnerRadius = d3.interpolate(this._innerRadius, innerRadius);
          var interpolOuterRadius = d3.interpolate(this._outerRadius, outerRadius);
          
          this._startAngle = startAngle;
          this._endAngle =   endAngle;
          this._innerRadius = innerRadius;
          this._outerRadius = outerRadius;
          
          var self = this;
          
          return function(t) {
            self._startAngle =  interpolStartAngle(t);
            self._endAngle =    interpolEndAngle(t);
            self._innerRadius = interpolInnerRadius(t);
            self._outerRadius = interpolOuterRadius(t);
            
            var datum = { startAngle:   self._startAngle,
                          endAngle:     self._endAngle,
                          innerRadius:  self._innerRadius,
                          outerRadius:  self._outerRadius};
            
            return arc(datum);
          };
        });
      }
      else {
        onUpdate = node;
        onUpdate.attr('d', function(d, i){
          var datum = { startAngle:   bound1(d, i),
                        endAngle:     limBound1(d, i),
                        innerRadius:  bound2(d, i),
                        outerRadius:  limBound2(d, i)};
          return arc(datum);
        });
      }
      onUpdate.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
    
      // On exit
      var onExit = node.exit();
      
      return {enter:onEnter, update:onUpdate, exit:onExit};
    }
  }
  
  // Draw a 'Segment' (Line or Arc)
  var drawSegment = function(node, deepestCoordSys, transition_duration, eltClass, getX, getY, bound1, bound2, limBound1, limBound2) {
    var onEnter = null;
    var onUpdate = null;
    var onExit = null;
    
    if(deepestCoordSys instanceof Rect) {
      // On enter
      onEnter = node.enter().append('line').attr('class', eltClass);
      onEnter.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
      onEnter.attr('x1', bound1);
      onEnter.attr('y1', bound2);
      onEnter.attr('x2', limBound1);
      onEnter.attr('y2', limBound2);
      
      // On update
      var onUpdate = null;
      if(transition_duration > 0) {
        onUpdate = node.transition().duration(transition_duration);
      }
      else {
        onUpdate = node;
      }
      onUpdate.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
      onUpdate.attr('x1', bound1);
      onUpdate.attr('y1', bound2);
      onUpdate.attr('x2', limBound1);
      onUpdate.attr('y2', limBound2);
      
      // On exit
      onExit = node.exit();
    }
    else if (deepestCoordSys instanceof Polar) {
      // On enter
      onEnter = node.enter().append('path').attr('class', eltClass);
      onEnter.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
      
      // On update
      var onUpdate = null;
      if(transition_duration > 0) {
        onUpdate = node.transition().duration(transition_duration);
      }
      else {
        onUpdate = node;
      }
      onUpdate.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
      
      // On exit
      onExit = node.exit();
      
      if(bound1 == limBound1) {
        var draw_line = function(angle, innerRadius, outerRadius) {
          var x1 = innerRadius * Math.cos(angle);
          var y1 = -innerRadius * Math.sin(angle);
          var x2 = outerRadius * Math.cos(angle);
          var y2 = -outerRadius * Math.sin(angle);
          
          return 'M '+x1+' '+y1+' L '+x2+' '+y2;
        }
        
        onEnter.attr('d', function(d, i){
            this._angle =       bound1(d, i);
            this._innerRadius = bound2(d, i);
            this._outerRadius = limBound2(d, i);
              
            return draw_line(this._angle, this._innerRadius, this._outerRadius);
          });
        
        
        onUpdate.attrTween('d', function(d, i) {
            var angle =       bound1(d, i);
            var innerRadius = bound2(d, i);
            var outerRadius = limBound2(d, i);
            
            var interpolAngle =       d3.interpolate(this._angle,       angle);
            var interpolInnerRadius = d3.interpolate(this._innerRadius, innerRadius);
            var interpolOuterRadius = d3.interpolate(this._outerRadius, outerRadius);
            
            this._angle =       angle;
            this._innerRadius = innerRadius;
            this._outerRadius = outerRadius;
            
            return function(t) {
              return draw_line(interpolAngle(t), interpolInnerRadius(t), interpolOuterRadius(t));
            };
          });
      }
      else {
        var draw_arc = function(startAngle, endAngle, radius) {
          var grand_angle = (endAngle - startAngle > Math.PI) ? 1 : 0;
          var x1 = radius * Math.cos(startAngle);
          var y1 = -radius * Math.sin(startAngle);
          var x2 = radius * Math.cos(endAngle);
          var y2 = -radius * Math.sin(endAngle);
          
          return 'M '+x1+' '+y1+' A '+radius+' '+radius+' 0 '+grand_angle+' 0 '+x2+' '+y2;
        }
        
        onEnter.attr('d', function(d, i){
            this._startAngle =  bound1(d, i);
            this._endAngle =    limBound1(d, i);
            this._radius =      bound2(d, i);
              
            return draw_arc(this._startAngle, this._endAngle, this._radius);
          });
        
        onUpdate.attrTween('d', function(d, i) {
            var startAngle =  bound1(d, i);
            var endAngle =    limBound1(d, i);
            var radius =      bound2(d, i);
            
            var interpolStartAngle =  d3.interpolate(this._startAngle,  startAngle);
            var interpolEndAngle =    d3.interpolate(this._endAngle,    endAngle);
            var interpolRadius =      d3.interpolate(this._radius, radius);
            
            this._startAngle = startAngle;
            this._endAngle =   endAngle;
            this._radius =     radius;
            
            var self = this;
            
            return function(t) {
              self._startAngle = interpolStartAngle(t);
              self._endAngle =   interpolEndAngle(t);
              self._radius =     interpolRadius(t);
              
              return draw_arc(self._startAngle, self._endAngle, self._radius);
            };
          });
      }
      
    }
    return {enter:onEnter, update:onUpdate, exit:onExit};
  }
  
  // Add padding to a continue interval
  var addPadding = function(interval, padding) {
    if(interval[0] != interval[1]) {
      return [interval[0] - (interval[1] - interval[0]) * padding,
              interval[1] + (interval[1] - interval[0]) * padding];
    }
    else if(interval[0] > 0) {
      return [0, interval[0] * 2];
    }
    else if(interval[0] < 0) {
      return [interval[0] * 2, 0];
    }
    else {
      return [-1, 1];
    }
  };
  
  // Sort and remove duplicate values of an Array
  var RemoveDupArray = function(a){
    var alreadyIn = {};
    
    var j = 0;
    for (var i = 0 ; i < a.length; i++){
      var val = a[i];
      
      if(!alreadyIn[val]) {
        alreadyIn[val] = true;
        a[j] = val;
        j++;
      }
    }
    a.splice(j);
  };
  
  // Determinate on which dimension we have to force to ordinal scale
  var getDimensionsInfo = function(coordSystem, temporalDim, axisProperty) {
    var dim = {};
    var cs = coordSystem;
    
    while(cs != null) {
      for(var i in cs.dimAlias) {
        if(cs.dimAlias[i] != null) {
          dim[cs.dimAlias[i]] = {isSpacial:true};
          
          // Force ordinal if the coordinate system have a sub coordinate system
          dim[cs.dimAlias[i]].forceOrdinal = (cs.subSys != null);
        }
      }
      cs = cs.subSys;
    }
    
    for(var i in temporalDim) {
      dim[i] = {forceOrdinal:true,
                isSpacial:false};
    }
    
    for(i in axisProperty) {
      if(isUndefined(dim[i])) {
        WARNING('In function Graphic.axis: axis '+i+' not defined');
      }
      else {
        for(var j in axisProperty[i]) {
          dim[i][j] = axisProperty[i][j];
        }
      }
    }
    
    return dim;
  };
  
  // Get aesthetic id from an attribute
  var getAesId = function(aes, dataCol2Aes, func2Aes, const2Aes, attr_val, datasetName, attr_name, originFunc) {
    var id;
    
    // If the attribute is bind to an aestetic
    if(typeof attr_val === 'string' && attr_val.indexOf(data_binding_prefix) == 0) {
      var column = attr_val.substring(data_binding_prefix.length);
      
      if(isUndefined(dataCol2Aes[column])) {
        dataCol2Aes[column] = [];
      }
      
      id = -1;
      for(var i = 0 ; i < dataCol2Aes[column].length ; i++) {
        if(aes[dataCol2Aes[column][i]].datasetName == datasetName) {
          id == dataCol2Aes[column][i];
          break;
        }
      }
      
      if(id == -1)
      {
        // We convert it into a fonction
        var toFunction = function (c) {
          return function (d) {
            return d[c];
          }
        };
        
        aes.push({func:toFunction(column),
                  datasetName:datasetName});
        id = aes.length - 1;
        dataCol2Aes[column].push(id);
      }
    }
    // If the value of the attribute is constant
    else if(typeof attr_val === 'number' || typeof attr_val === 'string') {
      if(isUndefined(const2Aes[attr_val])) {
        // We convert it into a fonction
        var toFunction = function (v) {
          return function () {
            return v;
          }
        };
        
        aes.push({func:toFunction(attr_val),
                  datasetName:datasetName,
                  // We set the domains while we know it's a constant value
                  discretDomain:[attr_val]});
        id = aes.length - 1;
        
        if(typeof attr_val === 'number')
          aes[id].continuousDomain = [attr_val, attr_val];
        
        const2Aes[attr_val] = id;
      }
      else
        id = const2Aes[attr_val];
    }
    // If the value of the attribute is computed by a function
    else if(typeof attr_val === 'function') {
      if(isUndefined(func2Aes[attr_val])) {
        func2Aes[attr_val] = [];
      }
      
      id = -1;
      for(var i = 0 ; i < func2Aes[attr_val].length ; i++) {
        if(aes[func2Aes[attr_val][i]].datasetName == datasetName) {
          id == func2Aes[attr_val][i];
          break;
        }
      }
      
      if(id == -1)
      {
        aes.push({func:attr_val,
                  datasetName:datasetName});
        id = aes.length - 1;
        func2Aes[attr_val].push(id);
      }
    }
    else {
      var attr_type = getTypeName(attr_val);
      
      ERROR('In '+originFunc+', attribute '+attr_name+' of type \''+attr_type+'\'\n'+
            'Expected:\n'+
            ' - constant value (string or number)\n'+
            ' - function\n'+
            ' - '+data_binding_prefix+'field (string)');
    }
      
    return id;
  };
  
  // Check aesthetic type
  var checkAesType = function(attr_type, aes_ret_type, attr, originFunc) {
    switch(attr_type) {
      case 'dimension':
        if(aes_ret_type != 'number' && aes_ret_type != 'string') {
          ERROR(errorAesMessage(originFunc, attr, aes_ret_type, 'position (\'number\' or \'string\')'));
        }
        break;
      case 'color':
        if(aes_ret_type != 'number' && aes_ret_type != 'string') {
          ERROR(errorAesMessage(originFunc, attr, aes_ret_type, 'color (\'number\' or \'string\')'));
        }
        break;
      case 'symbol':
        if(aes_ret_type != 'number' && aes_ret_type != 'string') {
          ERROR(errorAesMessage(originFunc, attr, aes_ret_type, 'symbol (\'number\' or \'string\')'));
        }
        break;
      case 'string':
        if(aes_ret_type != 'number' && aes_ret_type != 'string') {
          ERROR(errorAesMessage(originFunc, attr, aes_ret_type, '\'string\' (\'number\' accepted)'));
        }
        break;
      case 'number':
        if(aes_ret_type != 'number') {
          ERROR(errorAesMessage(originFunc, attr, aes_ret_type, '\'number\''));
        }
        break;
    }
  };
  
  // Compute domains of an aestetic
  var computeDomain = function(aes, dataset, type) {
    // Discret domain
    if(type == 'discret') {
      if(isUndefined(aes.discretDomain)) {
        var f = aes.func;
        aes.discretDomain = [];
        for(var k = 0 ; k < dataset.length ; k++) {
          aes.discretDomain.push(f(dataset[k], k));
        }
        RemoveDupArray(aes.discretDomain);
      }
    }
    // Continue domain
    else {
      if(isUndefined(aes.continuousDomain)) {
        // Compute continuous domain from discret one
        if(isDefined(aes.discretDomain)) {
          aes.continuousDomain = d3.extent(aes.discretDomain);
        }
        else {
          aes.continuousDomain = d3.extent(dataset, aes.func);
        }
      }
    }
  };
  
  // Compute domains of an aestetic
  var updateDomain = function(aes, newData, type) {
    // Discret domain
    if(type == 'discret') {
      var f = aes.func;
      var oldLength = aes.discretDomain.length;
      for(var i = 0 ; i < newData.length ; i++) {
        aes.discretDomain.push(f(newData[i], i));
      }
      RemoveDupArray(aes.discretDomain);
      
      var addedValues = [];
      for(var i = oldLength ; i < aes.discretDomain.length ; i++) {
        addedValues.push(aes.discretDomain[i]);
      }
      return addedValues;
    }
    // Continue domain
    else {
      var range = d3.extent(newData, aes.func);
      
      if(aes.continuousDomain[0] > range[0]) {
        aes.continuousDomain[0] = range[0];
      }
      if(aes.continuousDomain[1] < range[1]) {
        aes.continuousDomain[1] = range[1];
      }
    }
  };
  
  // Allocate split data array
  var allocateSplitDataArray = function(splitSizes, id) {
    if(id == splitSizes.length) {
      return [];
    }
    else {
      var array = new Array(splitSizes[id]);
      for(var i = 0 ; i < array.length ; i++) {
        array[i] = allocateSplitDataArray(splitSizes, id+1);
      }
      return array;
    }
  };
  
  // Convert numerical string value into pure numerical value
  var processRow = function(d) {
    for(var key in d) {
      var value = +d[key];
      if(!isNaN(value)) {
        d[key] = value;
      }
    }
    return d;
  };
  
  // Check if a parameter is defined or not and return its value or default value if any
  var checkParam = function(funcName, param, paramName, defaultValue) {
    // Parameter value not set
    if(isUndefined(param) || isUndefined(param[paramName])) {
      // Not default value
      if(isUndefined(defaultValue)) {
        var msg = 'In function '+funcName+': Missing parameter';
        if(isDefined(paramName)) {
          msg += ' \''+paramName+'\'';
        }
        ERROR(msg);
      }
      // Default value
      else {
        return defaultValue;
      }
    }
    // Parameter value set
    else {
      return param[paramName];
    }
  };
  
  // Get a listener that update a loading bar
  var getProgressListener = function(dl) {
    return function() {
      if(d3.event && d3.event.lengthComputable) {
        var svg = dl.g.svg;
        var width = svg.attr('width');
        var height = svg.attr('height');
        var barWidth = width / 2;
        var barHeight = 50;
        var margin = 2;
        
        var loadingBar = svg.select('#loading-bar');
        if(loadingBar.empty()) {
          loadingBar = svg.append('g').attr('id', 'loading-bar')
                                      .attr('transform', 'translate('+((width/2)-(barWidth/2))+','+((height/2)-(barHeight/2))+')');
          loadingBar.append('rect').attr('width', barWidth)
                                   .attr('height', barHeight)
                                   .attr('stroke', 'black')
                                   .attr('stroke_width', 2)
                                   .attr('fill', 'white');
          loadingBar.append('rect').attr('class', 'bar')
                                   .attr('x', margin)
                                   .attr('y', margin)
                                   .attr('width', 0)
                                   .attr('height', barHeight - margin * 2)
                                   .attr('fill', 'green');
                                   //.node().progress = 0;
        }
        var bar = loadingBar.select('.bar');
        bar.attr('width', (barWidth - margin * 2) * (d3.event.loaded / d3.event.total));
      }
    };
  };
  
  // Convert an angle from trigonometric to clock angle (but still in radians)
  var convertAngle = function(angle) {
    return (Math.PI/2 - angle);
  };
  
  // Iterator that go through an Array hierarchy
  var HierarchyIterator = function(h) {
    this.h = h;
    this.currentState = [];
    
    while(h[0] instanceof Array) {
      this.currentState.push(0);
      h = h[0];
    }
  };
  HierarchyIterator.prototype.hasNext = function() {
    return this.currentState != null;
  };
  HierarchyIterator.prototype.next = function() {
    if(!this.hasNext()) {
      throw StopIteration;
    }
    
    var ret = this.h;
    var size = new Array(this.currentState.length);
    
    // Get the current value
    for(var i = 0 ; i < this.currentState.length ; i++) {
      size[i] = ret.length;
      ret = ret[this.currentState[i]];
    }
    
    // Compute next state
    if(this.currentState.length == 0) {
      this.currentState = null;
    }
    else {
      var stop = false;
      var i = this.currentState.length - 1;
      while(!stop) {
        this.currentState[i]++;
        if(this.currentState[i] >= size[i]) {
          this.currentState[i] = 0;
          i--;
          
          if(i < 0) {
            this.currentState = null;
            stop = true;
          }
        }
        else {
          stop = true;
        }
      }
    }
    
    return ret;
  };
  
  // Get a unique string for a given current time
  var getTimeId = function(currentTime) {
    var id  = 'time';
    for(var i in currentTime) {
      id += '-'+currentTime[i];
    }
    return id;
  };
  
  // Remove all automatically shown pop-up
  var removePopups = function(g) {
    g.svg.selectAll('.pop-up.bound-to-time').remove();
  }
  
  // Generate an error message for aesthetic type error.
  var errorAesMessage = function(funcName, attribute, type, expected) {
    return 'In function '+funcName+': '+attribute+' can\'t be bound by values of type \''+type+
           '\'\nExpected: '+expected;
  };
  
  // Generate an error message for parameter type error.
  var errorParamMessage = function(funcName, paramName, type, expected) {
    return 'In function '+funcName+': '+paramName+' of type \''+type+
           '\'\nExpected: '+expected;
  };
  
  var ABORT = function() {
    throw 'Abort';
  };
  
  var ERROR = function(msg) {
    if(console.error) {
      console.error('Error: '+msg);
      ABORT();
    }
    else {
      throw msg;
    }
  };
  
  var WARNING = function(msg) {
    if(console.warn) {
      console.warn(msg);
    }
  };
  
  var ASSERT = function(condition, msg) {
    if(console.assert) {
      console.assert(condition, msg);
      if(!condition) {
        ABORT();
      }
    }
    else if(!condition) {
      throw 'Assertion failed: '+msg;
    }
  };
  
  var LOG = function(msg) {return;
    if(console.log) {
      console.log(msg)
    }
  };
  
  var TIMER_BEGIN = function(name, display) {
    if(display && console.time) {
      console.time(name)
    }
  };
  
  var TIMER_END = function(name, display) {
    if(display && console.timeEnd) {
      console.timeEnd(name)
    }
  };
  
  var TIMER_GROUP_BEGIN = function(name, display) {
    if(display) {
      if(console.time) {
        console.time(name);
      }
      if(console.groupCollapsed) {
        console.groupCollapsed(name+' (detail)');
      }
    }
  };
  
  var TIMER_GROUP_END = function(name, display) {
    if(display) {
      if(console.groupCollapsed) {
        console.groupEnd();
      }
      if(console.timeEnd) {
        console.timeEnd(name);
      }
    }
  };
  
  var isUndefined = function(a) {
    return typeof a === 'undefined';
  };
  
  var isDefined = function(a) {
    return !isUndefined(a);
  };
  
  var getTypeName = function(a) {
    return a.constructor.name;
  };
  
  
  /* From: http://strd6.com/2010/08/useful-javascript-game-extensions-clamp/ */
  Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this, min), max);
  };
  
  /* From: http://scott.sauyet.com/Javascript/Talk/Compose/2013-05-22/#slide-15 */
  Function.prototype.compose = function(g) {
    var fn = this;
    return function() {
      return fn.call(this, g.apply(this, arguments));
    };
  };
  
  /* From: http://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format */
  String.prototype.format = function() {
    var formatted = this;
    for (var i = 0; i < arguments.length; i++) {
      var regexp = new RegExp('\\{'+i+'\\}', 'gi');
      formatted = formatted.replace(regexp, arguments[i]);
    }
    return formatted;
  };
  
}();
