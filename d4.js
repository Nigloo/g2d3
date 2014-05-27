!function() {
'use strict';
  
  var lib_name = 'd4';
  
  var main_object = {
    version: '0.4'
  };
  window[lib_name] = main_object;
  
  // Some constants
  var data_binding_prefix = 'data:';
  var main_dataset_name = 'default_data';
  var time_dataset_name = 'time_data';
  var ordinal_scale_padding = 1;
  var linear_scale_padding = 0.1;
  var coordSysMargin = 0.15;
  var bar_padding = 1;
  
  
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
    this.dataset = {};
    this.dataset[main_dataset_name] = null;
    this.dataLoader = null;
    this.elements = [];
    this.fallback_element = new ElementBase();
    this.lastElementAdded = this.fallback_element;
    this.boxplot_function_called = false;
    
    
    this.render_param = null;
    this.data_view_generator = [];
    
    // Attributes non null only after render
    this.margin = null;
    this.svg = null;
    this.nestedData = null;
    this.currentTime = null;
    this.splitTempDimId = null;
    this.splitSpacialDimId = null;
    this.dim = null;
    this.timeSlider = null;
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
    
    // Set the origin function (for error message)
    for(var attr in this.fallback_element.attrs) {
      if(isDefined(this.fallback_element.attrs[attr].type)) {
        this.fallback_element.attrs[attr].originFunc = 'Graphic.element';
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
        stat_on = attr[i].value;
        stat_on_attr = i;
      }
      else if(this.spacialDimName.indexOf(i) >= 0) {
        group_by[i] = attr[i];
      }
    }
    for(var i in this.temporalDim) {
      group_by[i] = this.temporalDim[i];
    }
    group_by.group = attr.group;
    
    var groupByAes = [];
        
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
    
    var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, stat_on, main_dataset_name, 'stat_on', funcName);
    var statOnAes = aes[aesId];
    
    var aggregate = function(getDatum) {
      return function(data) {
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
          
          new_data = d3.merge([new_data, getDatum(sortedDataSubset, values)]);
        }
        
        return new_data;
      };
    };
    
    var computeStat = function(dataSubset, values) {
      var new_datum = {};
      for(var i in group_by) {
        if(typeof group_by[i] === 'string' && group_by[i].indexOf(data_binding_prefix) == 0) {
          var column = group_by[i].substring(data_binding_prefix.length);
          new_datum[column] = groupByAes[i].func(dataSubset[0], 0);
        } else {
          new_datum[i] = groupByAes[i].func(dataSubset[0], 0);
        }
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
      var i = 1;
      while((name+i+'.statistic') in this.dataset ||
            (name+i+'.outlier') in this.dataset) {
        i++;
      }
      name = name+i;
    }
    
    this.dataView({name:name+'.statistic', func:aggregate(computeStat)});
    this.dataView({name:name+'.outlier',  func:aggregate(computeOutliers)});
    
    var param = {};
    for(var i in group_by) {
      param[i] = group_by[i];
    }
    param.data = name+'.statistic';
    param[stat_on_attr] = d4.boxplotBoxStat();
    this.boxplotBox(param);
    
    param = {};
    for(var i in group_by) {
      param[i] = group_by[i];
    }
    param.data = name+'.outlier';
    param[stat_on_attr] = stat_on;
    param.group = getId;
    this.symbol(param)
    .on({event:'mouseover', listener:function(d, g) {
      d4.showPopup({id:name+'-outlier-hover', graphic:g, position:d4.mouse(g), text:statOnAes.func(d,0).toString()});
    }})
    .on({event:'mouseout',  listener:function(d, g) {
      d4.hidePopup({id:name+'-outlier-hover', graphic:g, duration:500});
    }});
    
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
    TIMER_BEGIN('Loading');
    if(data instanceof Array) {
      this.dataset[[main_dataset_name]] = data;
    }
    else if(data instanceof Object && isDefined(data.me) && data.me instanceof DataLoader) {
      this.dataLoader = data;
      data.me.g = this;
    }
    else {
      ERROR(errorParamMessage('Graphic.data', 'data', 'null',
        'Array  or value returned by '+lib_name+'.loadFromFile or '+lib_name+'.loadFromDatabase'));
    }
    
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
    this.dataset[main_dataset_name] = data;
    
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
    
    if(isUndefined(coordSys)) {
      // Default coordinate system
      this.coord(new Rect());
    }
    else {
      this.spacialCoord = coordSys;
      
      var coordSyss = [];
      
      while(coordSys != null) {
        coordSyss.push(coordSys);
        
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
        for(var j in coordSyss[i].dimName) {
          if(coordSyss[i].dimName[j] === undefined) {
            coordSyss[i].dimName[j] = generateName.call(this, j);
          }
          this.spacialDimName.push(coordSyss[i].dimName[j]);
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
    
    if(isUndefined(param)) {
      this.temporalDim = {};
    }
    else {
      this.temporalDim = param;
    }
    
    return this;
  };
  
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
    }
    
    return this;
  };

  // Render the graphic in svg
  Graphic.prototype.render = function(param) {
    // Check parameters
    var funcName = 'Graphic.render';
    var selector =  checkParam(funcName, param, 'selector', 'body');
    var width =     checkParam(funcName, param, 'width',    640);
    var height =    checkParam(funcName, param, 'height',   360);
    this.margin = { left:   checkParam(funcName, param, 'margin', 30),
                    top:    checkParam(funcName, param, 'margin', 10),
                    right:  checkParam(funcName, param, 'margin', 10),
                    bottom: checkParam(funcName, param, 'margin', 20)};
    this.margin.left =    checkParam(funcName, param, 'margin_left',    this.margin.left);
    this.margin.top =     checkParam(funcName, param, 'margin_top',     this.margin.top);
    this.margin.right =   checkParam(funcName, param, 'margin_right',   this.margin.right);
    this.margin.bottom =  checkParam(funcName, param, 'margin_bottom',  this.margin.bottom);
    
    
    // Reserve some space for the graphic while loading
    // Add Canvas
    if(this.svg == null) {
      this.svg = d3.select(selector)
                   .append("svg")
                   .attr("width", width)
                   .attr("height", height);
    }
    
    if(this.dataset[main_dataset_name] == null) {
      if(this.dataLoader != null) {
        this.render_param = param;
        this.dataLoader.sendXhrRequest();
        return this;
      }
      else {
        ERROR('Can\'t plot without data');
      }
    }
    else {
      this.onDataLoaded(this.dataset[main_dataset_name]);
    }
    TIMER_END('Loading');
    LOG("Ready to plot: selector={0}, width={1}, height={2}".format(
          selector,
          width,
          height));
    LOG("Margin: left={0}, right={1}, top={2}, bottom={3}".format(
          this.margin.left,
          this.margin.right,
          this.margin.top,
          this.margin.bottom));
    
    if(this.elements.length == 0) {
      ERROR('no element in the graphic');
    }
    
    
    /*                                                *\
     * Generation of data views (per element dataset) *
    \*                                                */
    TIMER_BEGIN('Generation of data views');
    for(var i = 0 ; i < this.data_view_generator.length ; i++) {
      var name = this.data_view_generator[i].name;
      var func = this.data_view_generator[i].func;
      if(isDefined(this.dataset[name])) {
        WARNING('Dataset '+name+' already defined');
      }
      this.dataset[name] = func(this.dataset[main_dataset_name]);
    }
    this.data_view_generator = [];
    
    // Check if dataset exist
    for(var i = 0 ; i < this.elements.length ; i++) {
      if(!(this.elements[i].datasetName in this.dataset)) {
        ERROR('Data view '+this.elements[i].datasetName+' of element '+i+' ('+getTypeName(this.elements[i])+') is not defined');
      }
    }
    
    // Temporal dimension dataset
    var time_dataset = [];
    var added = {};
    for(var i = 0 ; i < this.elements.length ; i++) {
      var datasetName = this.elements[i].datasetName;
      if(!added[datasetName]) {
        var dataset = this.dataset[datasetName];
        for(var j = 0 ; j < dataset.length ; j++) {
          time_dataset.push(dataset[j]);
        }
        added[datasetName] = true;
      }
    }
    this.dataset[time_dataset_name] = time_dataset;
    TIMER_END('Generation of data views');
    
    
    /*                                              *\
     * Detection of attributes which are dimensions *
     * Deletion of useless attributes               *
    \*                                              */
    
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i].attrs) {
        // This attribute is a dimension
        if(this.spacialDimName.indexOf(attr) >= 0) {
          this.elements[i].attrs[attr].type = 'dimension';
        }
        
        // Useless attribute
        if(this.elements[i].attrs[attr].type === 'unknown' ||
           this.elements[i].attrs[attr].value == null) {
          delete this.elements[i].attrs[attr];
        }
      }
    }
    
    
    /*                                               *\
     * Standardization of aesthetics                 *
     * Collecting some informations about dimensions *
    \*                                               */
    TIMER_BEGIN('Standardization aesthethics');
    // Information on each dimension
    this.dim = getDimensionsInfo(this.spacialCoord, this.temporalDim);
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
    
    // Aesthetics of elements
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i].attrs) {
        var attr_type = this.elements[i].attrs[attr].type;
        var attr_val = this.elements[i].attrs[attr].value;
        var originFunc = this.elements[i].attrs[attr].originFunc;
        var datasetName = this.elements[i].datasetName;
        var dataset = this.dataset[datasetName];
        
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
          
          var aesId1 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.boundary1.value, datasetName, attr, originFunc);
          var aesId2 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.boundary2.value, datasetName, attr, originFunc);
          
          // Check data type return by those aesthetics
          var aes_ret_type = typeof aes[aesId1].func(dataset[0], 0);
          checkAesType('number', aes_ret_type, 'first param', originFunc);
          aes_ret_type = typeof aes[aesId2].func(dataset[0], 0);
          checkAesType('number', aes_ret_type, 'second param', originFunc);
          
          // Not stacked
          if(!attr_val.stacked) {
            attr_val.boundary1.aes = aes[aesId1];
            attr_val.boundary2.aes = aes[aesId2];
          }
          // Stacked
          else {
            var func = aes[aesId1].func;
            var origin = aes[aesId2].func;
            
            var context = { lastI:null,
                            boundary1:null,
                            boundary2:null};
            var updateBoundaries = function(d, i) {
              if(i != context.lastI) {
                if(i == 0) {
                  context.boundary2 = origin(d, i);
                }
                
                context.boundary1 = context.boundary2;
                context.boundary2 = context.boundary1 + func(d, i);
                context.lastI = i;
              }
            };
            
            attr_val.boundary1.aes = {func:function(d, i) {
                updateBoundaries(d, i);
                return context.boundary1;
              },
              datasetName:datasetName};
            
            attr_val.boundary2.aes = {func:function(d, i) {
                updateBoundaries(d, i);
                return context.boundary2;
              },
              datasetName:datasetName};
          }
          
          this.dim[attr].aes.push(attr_val.boundary1.aes);
          this.dim[attr].aesElemId.push(i);
          this.dim[attr].aes.push(attr_val.boundary2.aes);
          this.dim[attr].aesElemId.push(i);
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
          
          
          var aesQ1 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.quartile1.value, datasetName, attr, originFunc);
          var aesQ2 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.quartile2.value, datasetName, attr, originFunc);
          var aesQ3 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.quartile3.value, datasetName, attr, originFunc);
          var aesW1 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.whisker1.value,  datasetName, attr, originFunc);
          var aesW2 = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val.whisker2.value,  datasetName, attr, originFunc);
          
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
          
          attr_val.quartile1.aes = aes[aesQ1];
          attr_val.quartile2.aes = aes[aesQ2];
          attr_val.quartile3.aes = aes[aesQ3];
          attr_val.whisker1.aes =  aes[aesW1];
          attr_val.whisker2.aes =  aes[aesW2];
          
          // Just min and max values
          this.dim[attr].aes.push(attr_val.whisker1.aes);
          this.dim[attr].aesElemId.push(i);
          this.dim[attr].aes.push(attr_val.whisker2.aes);
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
        }
      }
      
      if(this.elements[i] instanceof BoxPlot) {
        var originFunc = lib_name+'.boxplotStat';
        var nbBoxPlotStat = 0;
        for(var j = 0 ; j < deepestCoordSysDim.length ; j++) {
          if(this.elements[i].attrs[deepestCoordSysDim[j]].value instanceof BoxPlotBoxStat) {
            nbBoxPlotStat++;
          }
        }
        
        if(nbBoxPlotStat != 1) {
          ERROR('One and only one of the attributes '+deepestCoordSysDimNames+' must be set with '+originFunc);
        }
      }
        
      // Checking for unset dimension attribute
      for(var j in this.dim) {
        if(isUndefined(this.elements[i].attrs[j]) && this.dim[j].isSpacial) {
          ERROR('No value found for the attribute '+j+' of '+getTypeName(this.elements[i]));
        }
      }
    }
    
    
    // Aesthetics of temporal dimensions
    for(var i in this.temporalDim) {
      // Get the aestetic id
      var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, this.temporalDim[i], time_dataset_name, i, 'Graphic.time');
      
      // Check data type return by this aesthetic
      var aes_ret_type = typeof aes[aesId].func(this.dataset[time_dataset_name][0], 0);
      if(aes_ret_type != 'number' && aes_ret_type != 'string') {
        ERROR(errorAesMessage('Graphic.time', i, aes_ret_type, '\'number\' or \'string\''));
      }
      // There is one and only one aesthetic per temporal dimension
      this.dim[i].aes = [aes[aesId]];
    }
    
    // We don't need those variables anymore
    aes = undefined;
    dataCol2Aes = undefined;
    func2Aes = undefined;
    const2Aes = undefined;
    TIMER_END('Standardization aesthethics');
    
    
    /*                                                         *\
     * Computing dimensions' domains                           *
     * EXCEPT the deepest spacial coordinate system dimensions *
    \*                                                         */
    TIMER_BEGIN('Dimension domain 1');
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
        
        for(var k = 0 ; k < dom.length ; k++)
          domain.push(dom[k]);
      }
      RemoveDupArray(domain);
      
      
      this.dim[i].domain = domain;
      this.dim[i].ordinal = true;
    }
    
    TIMER_END('Dimension domain 1');
    
    
    /*                                 *\
     * Splitting data for each element *
    \*                                 */
    TIMER_BEGIN('Split');
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
    
    // Splitting data according to spacial dimensions
    this.splitSpacialDimId = [];
    for(var i in this.dim) {
      if(this.dim[i].isSpacial && this.dim[i].forceOrdinal) {
        this.splitSpacialDimId.push(i);
        splitSizes.push(this.dim[i].domain.length);
      }
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
          // There is only one aesthetic per temporal dimension
          var value = this.dim[this.splitTempDimId[k]].aes[0].func(dataset[j], j);
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
    TIMER_END('Split');
    
    
    /*                                          *\
     * Computing the deepest spacial coordinate *
     * system dimensions' domains               *
    \*                                          */
    TIMER_BEGIN('Dimension domain 2');
    for(var i in this.dim) {
      if(this.dim[i].forceOrdinal) {
        continue;
      }
      
      var domain;
      var ordinal;
      
      // Don't force ordinal (i.e. continue if only number values)
      var ordinal = false;
      for(var j = 0 ; j < this.dim[i].aes.length ; j++) {
        var dataset = this.dataset[this.dim[i].aes[j].datasetName];
        if(typeof this.dim[i].aes[j].func(dataset[0], 0) != 'number') {
          ordinal = true;
          break;
        }
      }
      
      // Ordinal domain
      if(ordinal) {
        domain = [];
        var dim = this.dim[i];
        for(var j = 0 ; j < dim.aes.length ; j++) {
          var it = new HierarchyIterator(this.nestedData[dim.aesElemId[j]]);
          while(it.hasNext()) {
            var dataSubset = it.next();
            // Compute discret domain
            for(var k = 0 ; k < dataSubset.length ; k++) {
              domain.push(this.dim[i].aes[j].func(dataSubset[k], k));
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
            for(var k=0;k<dataset.length;k++)
            var dom = d3.extent(dataSubset, this.dim[i].aes[j].func);
            
            if(dom[0] < domain[0])
              domain[0] = dom[0];
            if(dom[1] > domain[1])
              domain[1] = dom[1];
          }
        }
        if(domain[0] == domain[1]) {
          domain = addPadding(domain, linear_scale_padding);
        }
      }
      
      this.dim[i].domain = domain;
      this.dim[i].ordinal = ordinal;
    }
    TIMER_END('Dimension domain 2');
    
    
    /*                         *\
     * Generating time sliders *
    \*                         */
    TIMER_BEGIN('Sliders');
    this.timeSlider = [];
    var timeSliderInfo = [];
    var nbSlider = 0;
    var sliderHeight = 50;
    var sliderSize = width - this.margin.left - this.margin.right;
    
    for(var i in this.dim) {
      if(this.dim[i].isSpacial) {
        continue;
      }
      
      timeSliderInfo[i] = {};
      this.timeSlider[i] = {};
      
      var values = this.dim[i].domain;
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
      
      var getOnBrushed = function(brush, handle, g, timeDim, mouseToValue) {
        return function(){
          var posX = brush.extent()[0];

          if (d3.event.sourceEvent) { // not a programmatic event
            posX = d3.mouse(this)[0];
            
            posX = posX.clamp(0, sliderSize);
            
            brush.extent([posX, posX]);
          }
          
          handle.interrupt().transition();
          handle.attr("cx", posX);
          var index = g.dim[timeDim].domain.indexOf(mouseToValue(posX));
          if(g.currentTime[timeDim] != index) {
            g.currentTime[timeDim] = index;
            g.updateElements();
          }
        }
      };
      
      var getOnBrushEnd = function(brush, handle, mouseToValue, valueToMouse) {
        return function(){
          var posX = brush.extent()[0];

          if (d3.event.sourceEvent) { // not a programmatic event
            posX = d3.mouse(this)[0];
            posX.clamp(0, sliderSize);
            
            posX = valueToMouse(mouseToValue(posX));
            
            brush.extent([posX, posX]);
          }
          
          handle.interrupt().transition().attr("cx", posX);
        }
      };
      
      timeSliderInfo[i].axis = axis;
      timeSliderInfo[i].brush = brush;
      timeSliderInfo[i].getOnBrushed = getOnBrushed;
      timeSliderInfo[i].getOnBrushEnd = getOnBrushEnd;
      
      this.timeSlider[i].mouseToValue = mouseToValue;
      this.timeSlider[i].valueToMouse = valueToMouse;
      
      nbSlider++;
    }
    // Reserve some space for sliders
    this.margin.bottom += sliderHeight * nbSlider;
    TIMER_END('Sliders');
    
    
    /*                  *\
     * Computing scales *
    \*                  */
    TIMER_BEGIN('Scales');
    // For the coordinate system
    this.spacialCoord.computeScale( this.dim, 
                                    width - this.margin.left - this.margin.right,
                                    height - this.margin.top - this.margin.bottom);
    
    // For other attributes
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i].attrs) {
        // Skip non-set attributes
        if(this.elements[i].attrs[attr].value == null ||
           this.elements[i].attrs[attr].type === 'dimension') {
          continue;
        }
        
        var attr_type = this.elements[i].attrs[attr].type;
        var attr_aes = this.elements[i].attrs[attr].aes;
        var aes_ret_type = typeof attr_aes.func(this.dataset[this.elements[i].datasetName][0], 0);
        
        
        switch(attr_type) {
          case 'color':
            if(aes_ret_type === 'string') {
              // No scaling
              this.elements[i].attrs[attr].func = attr_aes.func;
            }
            else {
              // Compute continuous domain
              computeDomain(attr_aes, this.dataset[attr_aes.datasetName], 'continuous');
              
              // Scaling
              var scale = d3.scale.category10().domain(attr_aes.continuousDomain);
              
              this.elements[i].attrs[attr].func = scale.compose(attr_aes.func);
            }
            break;
          
          case 'symbol':
            if(aes_ret_type === 'string') {
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
            if(aes_ret_type === 'string') {
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
    TIMER_END('Scales');
    
    
    /*                *\
     * Generating svg *
    \*                */
    TIMER_BEGIN('SVG');
    // Add background
    this.spacialCoord.drawBackground( this.svg,
                                      this.dim,
                                      this.margin.left,
                                      this.margin.top,
                                      width-this.margin.left-this.margin.right,
                                      height-this.margin.top-this.margin.bottom);
    
    // Add axis
    this.spacialCoord.drawAxis( this.svg,
                                this.dim,
                                this.margin.left,
                                this.margin.top,
                                width-this.margin.left-this.margin.right,
                                height-this.margin.top-this.margin.bottom);
    
    // Add time sliders
    var offsetY = height - sliderHeight * nbSlider;
    var handleSize = 18;
    for(var i in this.timeSlider) {
      var slider = this.svg.append('g').attr('class', 'slider')
                                       .attr('transform', 'translate('+this.margin.left+','+offsetY+')');
      this.timeSlider[i].svg = slider;
      
      var axis = slider.append('g').attr('class', 'axis')
                                   .attr('transform', 'translate(0,'+sliderHeight/2 +')')
                                   .call(timeSliderInfo[i].axis)
                                   .style('font', '10px sans-serif')
                                   .style('-webkit-user-select', 'none')
                                   .style('-moz-user-select', 'none')
                                   .style('user-select', 'none');
      
      axis.select('.domain').style('fill', 'none')
                            .style('stroke', '#000')
                            .style('stroke-opacity', '0.3')
                            .style('stroke-width', '10')
                            .style('stroke-linecap', 'round')
          .select(function(){return this.parentNode.appendChild(this.cloneNode(true));})
                            .style('stroke', '#ddd')
                            .style('stroke-opacity', '1')
                            .style('stroke-width', '8');
      
      var brush = slider.append('g').attr('class', 'brush')
                                    .call(timeSliderInfo[i].brush);
      
      brush.selectAll('.extent,.resize').remove();
      brush.select('.background').attr('width', sliderSize + handleSize)
                                 .attr('height', handleSize)
                                 .attr('x', -handleSize/2)
                                 .attr('transform', 'translate(0,'+(sliderHeight/2-handleSize/2)+')')
                                 .style('cursor', 'auto');
      
      var handle = brush.append('circle').attr('class', 'handle')
                                         .attr('transform', 'translate(0,'+(sliderHeight/2)+')')
                                         .attr('r', handleSize/2)
                                         .style('fill', '#fff')
                                         .style('stroke', '#000')
                                         .style('stroke-opacity', '0.5')
                                         .style('stroke-width', '1.25px')
                                         .style('pointer-events', 'none');
      
      timeSliderInfo[i].brush.on('brush', 
        timeSliderInfo[i].getOnBrushed(timeSliderInfo[i].brush, handle,
                                       this, i, this.timeSlider[i].mouseToValue));
                                       
      timeSliderInfo[i].brush.on('brushend',
        timeSliderInfo[i].getOnBrushEnd(timeSliderInfo[i].brush, handle,
                                        this.timeSlider[i].mouseToValue,
                                        this.timeSlider[i].valueToMouse));
      
      handle.call(timeSliderInfo[i].brush.event);
      
      offsetY += sliderHeight;
    }
    this.updateSliders();
    
    // Draw elements
    this.updateElements();
    TIMER_END('SVG');
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
    
    
    // Deepest coordinate system
    var deepestCoordSys = this.spacialCoord;
    while(deepestCoordSys.subSys != null) {
      deepestCoordSys = deepestCoordSys.subSys;
    }
    
    // Deepest coordinate system dimention
    var deepestCoordSysDim = [];
    for(var i in deepestCoordSys.dimName) {
      deepestCoordSysDim.push({ name:deepestCoordSys.dimName[i],
                                originalName:i});
    }
    
    
    // Draw elements
    for(var i = 0 ; i < this.elements.length ; i++) {
      /*                                     *\
       * Compute 'getX' and 'getY' functions *
      \*                                     */
      
      var getGetX = function (cs, f, p, ml) {
        return function (d, i) {
          return ml + cs[f](p, d, i);
        }
      };
      
      var getGetY = function (cs, f, p, mt) {
        return function (d, i) {
          return mt + cs[f](p, d, i);
        }
      };
      
      var pos = [];
      
      for(var j in this.dim) {
        if(this.dim[j].isSpacial) {
          if(!(this.elements[i].attrs[j].value instanceof Interval) &&
             !(this.elements[i].attrs[j].value instanceof BoxPlotBoxStat)) {
            pos[j] = this.elements[i].attrs[j].aes.func;
          }
        }
      }
      
      var getX = null;
      var getY = null;
      
      if(this.elements[i] instanceof Bar ||
         this.elements[i] instanceof BoxPlot) {
        getX = getGetX(this.spacialCoord, 'getXOrigin', pos, this.margin.left);
        getY = getGetY(this.spacialCoord, 'getYOrigin', pos, this.margin.top);
      }
      else {
        getX = getGetX(this.spacialCoord, 'getX', pos, this.margin.left);
        getY = getGetY(this.spacialCoord, 'getY', pos, this.margin.top);
      }
      
      /*               *\
       * Draw elements *
      \*               */
      
      // Data belonging to the current time
      var dataToDisplay = this.nestedData[i];
      for(var j in this.currentTime) {
        dataToDisplay = dataToDisplay[this.currentTime[j]];
      }
      
      var it = new HierarchyIterator(dataToDisplay);
      var id = 0;
      while(it.hasNext()) {
        var dataSubset = it.next();
        var eltClass = 'etl-'+i+'-'+(id++);
        
        // Set attributes for each kind of elements
        // Symbol
        if(this.elements[i] instanceof Symbol) {
          var symbol = d3.svg.symbol();
          
          if(isDefined(this.elements[i].attrs.type))
            symbol.type(this.elements[i].attrs.type.func);
            
          if(isDefined(this.elements[i].attrs.size))
            symbol.size(this.elements[i].attrs.size.func);
          
          var node = this.svg.selectAll('.'+eltClass)
                         .data(dataSubset);
          
          // On enter
          var onEnter = node.enter().append('path').attr('class', eltClass);
          
          svgSetCommonAttributesPerElem(onEnter, this.elements[i]);
          onEnter.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
          onEnter.attr('d', symbol);
          
          var listeners = this.elements[i].listeners;
          var g = this;
          
          var GetFunc = function(event) {
            return function(d) {
              listeners[event].call(this, d, g);
            }
          }
          
          for(var event in listeners) {
            node.on(event, GetFunc(event));
          }
          
          // On exit
          node.exit().remove();
          
          // On update
          var onUpdate = node.transition();
          
          svgSetCommonAttributesPerElem(onUpdate, this.elements[i]);
          onUpdate.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
          node.attr('d', symbol); // Transition bug here...
        }
        
        // Lines
        else if(this.elements[i] instanceof Line) {
          var interpolation;
          if(dataSubset.length > 0) {
            interpolation = this.elements[i].attrs.interpolation.func(dataSubset[0], 0);
          }
          else {
            interpolation = '';
          }
          
          var lineFunction = d3.svg.line()
                               .x(getX)
                               .y(getY)
                               .interpolate(interpolation);
          
          var node;
          // On enter
          if(this.svg.select('.'+eltClass).empty()) {
            node = this.svg.append('path').attr('class', eltClass);
          }
          // On update
          else {
            node = this.svg.select('.'+eltClass).transition();
          }
          
          node.attr("d", lineFunction(dataSubset));
          
          if(dataSubset.length > 0) {
            svgSetCommonAttributesPerGroup(node, this.elements[i], dataSubset[0], 0);
            svgSetAttributePerGroup(node, 'stroke-linecap', this.elements[i], 'stroke_linecap', dataSubset[0], 0);
          }
          else {
            svgSetCommonAttributesPerGroup(node, this.elements[i], null);
            svgSetAttributePerGroup(node, 'stroke-linecap', this.elements[i], 'stroke_linecap', null);
          }
          
          // Nothing to do on exit, there will just be an empty path
        }
        
        // Bars
        else if(this.elements[i] instanceof Bar) {
          var boundaryFunc = [];
          var padding = null;
          
          if(deepestCoordSys instanceof Rect) {
            padding = bar_padding;
          }
          else if(deepestCoordSys instanceof Polar) {
            padding = 0;
          }
          
          for(var j = 0 ; j < deepestCoordSysDim.length ; j++) {
            var dimName = deepestCoordSysDim[j].name;
            var originalDimName = deepestCoordSysDim[j].originalName;
            
            boundaryFunc[originalDimName]  = {  min:null,
                                                max:null,
                                                dist:null};
            
            if(dimName == null) {
              var min = deepestCoordSys.boundary[originalDimName].min;
              var max = deepestCoordSys.boundary[originalDimName].max;
              var dist = max - min;
              
              boundaryFunc[originalDimName].min = getConst(min);
              boundaryFunc[originalDimName].max = getConst(max);
              boundaryFunc[originalDimName].dist = getConst(dist);
            }
            else {
              var scale = deepestCoordSys.scale[originalDimName];
              
              var bound1 = null;
              var bound2 = null;
              
              if(this.elements[i].attrs[dimName].value instanceof Interval) {
                var interval = this.elements[i].attrs[dimName].value;
                
                bound1 = scale.compose(interval.boundary1.aes.func),
                bound2 = scale.compose(interval.boundary2.aes.func);
              }
              else {
                var band = this.dim[dimName].band / (1 + padding);
                var func = this.elements[i].attrs[dimName].aes.func;
                
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
          
          var node = this.svg.selectAll('.'+eltClass)
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
                          eltClass,
                          getX,
                          getY,
                          boundaryFunc[dim1].min,
                          boundaryFunc[dim2].min,
                          boundaryFunc[dim1][lim],
                          boundaryFunc[dim2][lim]);
          
          // On enter
          svgSetCommonAttributesPerElem(node.enter, this.elements[i]);
          
          // On update
          svgSetCommonAttributesPerElem(node.update, this.elements[i]);
          
          // On exit
          node.exit.remove();
        }
      
        // BoxPlot
        else if(this.elements[i] instanceof BoxPlot) {
          var whiskers_size = 0.5;
          var whiskers_ratio = (1 - whiskers_size) / 2;
          
          var posFunc = [];
          
          for(var j = 0 ; j < deepestCoordSysDim.length ; j++) {
            var dimName = deepestCoordSysDim[j].name;
            var originalDimName = deepestCoordSysDim[j].originalName;
            
            // Pos
            posFunc[originalDimName] = {// The box
                                        box:{},
                                        // Median Line
                                        median:{},
                                        // Line between the first quartile and the first whisker (min)
                                        w1:{},
                                        // Line between the third quartile and the second whisker (max)
                                        w2:{},
                                        // Line at the first whisker
                                        wl1:{},
                                        // Line at the second whisker
                                        wl2:{}};
                                        
            var p = posFunc[originalDimName];
            
            if(dimName == null || !(this.elements[i].attrs[dimName].value instanceof BoxPlotBoxStat)) {
              if(dimName == null) {
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
                
                var band = this.dim[dimName].band / (1 + bar_padding);
                var func = this.elements[i].attrs[dimName].aes.func;
                
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
              p.w1.max = p.w1.min;
              p.w1.dist = getConst(0);
              p.w2 = p.w1;
              p.wl2 = p.wl1;
            }
            else {
              var scale = deepestCoordSys.scale[originalDimName];
              var boxplotStat = this.elements[i].attrs[dimName].value;
              
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
              p.median.min = q2;
              p.median.max = q2;
              p.median.dist = getConst(0);
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
          
          // The box
          var nodeBox = this.svg.selectAll('.'+eltClass+'.box')
                              .data(dataSubset);
          nodeBox = drawBox( nodeBox,
                          deepestCoordSys,
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
          
          // Median
          var nodeMedian = this.svg.selectAll('.'+eltClass+'.median')
                              .data(dataSubset);
          nodeMedian = drawSegment( nodeMedian,
                          deepestCoordSys,
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
          
          // First whisker
          var nodeWisker1 = this.svg.selectAll('.'+eltClass+'.whisker.min')
                              .data(dataSubset);
          nodeWisker1 = drawSegment( nodeWisker1,
                          deepestCoordSys,
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
          var nodeWisker2 = this.svg.selectAll('.'+eltClass+'.whisker.max')
                              .data(dataSubset);
          nodeWisker2 = drawSegment( nodeWisker2,
                          deepestCoordSys,
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
          var nodeWiskerLimit1 = this.svg.selectAll('.'+eltClass+'.whisker_limit.min')
                              .data(dataSubset);
          nodeWiskerLimit1 = drawSegment( nodeWiskerLimit1,
                          deepestCoordSys,
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
          
          // Second whisker limite
          var nodeWiskerLimit2 = this.svg.selectAll('.'+eltClass+'.whisker_limit.max')
                              .data(dataSubset);
          nodeWiskerLimit2 = drawSegment( nodeWiskerLimit2,
                          deepestCoordSys,
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
          
        }
        else {
          ERROR('Type of element '+i+' is not an element but an '+getTypeName(this.elements[i]));
        }
      }
    }
    
    return this;
  };
  
  // Update position of time sliders' cursor
  Graphic.prototype.updateSliders = function() {
    for(var i in this.timeSlider) {
      var value = this.dim[i].domain[this.currentTime[i]];
      var posX = this.timeSlider[i].valueToMouse(value);
      
      this.timeSlider[i].svg.select('.brush')
                            .select('.handle')
                            .transition()
                            .attr('cx', posX);
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
                            value:null}
      };
    
    this.listeners = [];
    this.datasetName = main_dataset_name;
  };
    
  function Symbol() {
    this.attrs = {
        type: { type:'symbol',
                value:'circle'},
        size: { type:'number',
                value:null}
      };
                    
    this.listeners = [];
  };
  
  function Line() {
    this.attrs = {
        interpolation:  { type:'string',
                          value:'linear'},
        stroke_linecap: { type:'string',
                           value:null}
      };
     
    this.listeners = [];
  };
  
  function Bar() {
    // No specific attributes
    this.attrs = {};
    
    this.listeners = [];
  };
  
  function BoxPlot() {
    // No specific attributes
    this.attrs = {};
    
    this.listeners = [];
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
  
  /////// CARTESIAN ///////
  function Rect(param) {
    this.dimName = [];
    this.scale = [];
    this.boundary = [];
    for(var i = 0 ; i < Rect.prototype.dimName.length ; i++) {
      this.dimName[Rect.prototype.dimName[i]] = undefined;
      this.scale[Rect.prototype.dimName[i]] = null;
    }
    
    
    this.subSys = null;
    
    if(isUndefined(param)) {
      return;
    }
    
    for(var i in this.dimName) {
      var type = typeof param[i];
      if(type != 'undefined') {
        if(type != 'number' && type != 'string' && param[i] != null) {
          ERROR(errorParamMessage(lib_name+'.rect', i, type, '\'number\' or \'string\''));
        }
        else {
          this.dimName[i] = param[i];
        }
      }
    }
    
    if(isDefined(param.subSys) && !(param.subSys instanceof Rect) && !(param.subSys instanceof Polar)) {
      ERROR(errorParamMessage(lib_name+'.rect', 'subSys', typeof param.subSys, '\'Rect\' or \'Polar\''));
    }
    else {
      this.subSys = param.subSys;
    }
  };
  
  Rect.prototype.dimName = ['x', 'y'];
    
  Rect.prototype.computeScale = function(dim, width, height) {
    var size = {x:width,
                y:height};
    var subSize = {};
    var ranges = {x:[0, width],
                  y:[height, 0]};
    
    
    for(var i in this.dimName) {
      if(this.dimName[i] == null) {
        subSize[i] = size[i];
      }
      else if(this.subSys != null) {
        this.scale[i] = d3.scale.ordinal()
                        .domain(dim[this.dimName[i]].domain)
                        .rangeRoundBands(ranges[i], coordSysMargin);
        subSize[i] = this.scale[i].rangeBand();
      }
      else if(dim[this.dimName[i]].ordinal) {
        this.scale[i] = d3.scale.ordinal()
                        .domain(dim[this.dimName[i]].domain)
                        .rangePoints(ranges[i], ordinal_scale_padding);
        subSize[i] = Math.abs(ranges[i][0] - ranges[i][1]) / (dim[this.dimName[i]].domain.length - 1 + ordinal_scale_padding);
      }
      else {
        this.scale[i] = d3.scale.linear()
                        .domain(addPadding(dim[this.dimName[i]].domain, linear_scale_padding))
                        .range(ranges[i])
                        .nice();
        subSize[i] = size[i] / (this.scale[i].domain()[1] - this.scale[i].domain()[0]);
      }
      
      if(this.dimName[i] != null) {
        dim[this.dimName[i]].band = subSize[i];
      }
      
      this.boundary[i] = {min:0, max:size[i]};
    }
    
    
    // Sub coordinate system scale
    if(this.subSys != null) {
      this.subSys.computeScale(dim, subSize['x'], subSize['y']);
    }
  };
    
  Rect.prototype.getX = function(pos, d, i) {
    var X = null;
    if(this.dimName['x'] == null) {
      if(this.subSys == null) {
        X = this.boundary['x'].max / 2;
      }
      else {
        X = 0;
      }
    }
    else if(pos[this.dimName['x']] == null) {
      X =  0;
    }
    else {
      X = this.scale['x'](pos[this.dimName['x']](d, i));
    }
    
    if(this.subSys != null) {
      X += this.subSys.getX(pos, d, i);
    }
    
    return X;
  };
  
  Rect.prototype.getY = function(pos, d, i) {
    var Y = null;
    if(this.dimName['y'] == null) {
      if(this.subSys == null) {
        Y = this.boundary['y'].max / 2;
      }
      else {
        Y = 0;
      }
    }
    else if(pos[this.dimName['y']] == null) {
      Y = 0;
    }
    else {
      Y = this.scale['y'](pos[this.dimName['y']](d, i));
    }
    
    if(this.subSys != null) {
      Y += this.subSys.getY(pos, d, i);
    }
    
    return Y;
  };
  
  Rect.prototype.getXOrigin = function(pos, d, i) {
    var X = null;
    
    if(this.subSys == null || this.dimName['x'] == null) {
      X = 0;
    }
    else {
      X = this.scale['x'](pos[this.dimName['x']](d, i));
    }
    
    if(this.subSys != null) {
      X += this.subSys.getXOrigin(pos, d, i);
    }
    
    return X;
  };
  
  Rect.prototype.getYOrigin = function(pos, d, i) {
    var Y = null;
    
    if(this.subSys == null || this.dimName['y'] == null) {
      Y = 0;
    }
    else {
      Y = this.scale['y'](pos[this.dimName['y']](d, i));
    }
    
    if(this.subSys != null) {
      Y += this.subSys.getYOrigin(pos, d, i);
    }
    
    return Y;
  };
  
  Rect.prototype.drawBackground = function(svg, dim, offsetX, offsetY, width, height) {
    svg.append('g')
    .attr('class', 'background')
    .attr('transform', 'translate('+offsetX+','+offsetY+')')
    .append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill','orange')
    .attr('fill-opacity',0.3);
    
    if(this.subSys != null) {
      var rangeX = (this.dimName['x'] != null) ? this.scale['x'].range() : [0];
      var rangeY = (this.dimName['y'] != null) ? this.scale['y'].range() : [0];
      var subWidth = (this.dimName['x'] != null) ? this.scale['x'].rangeBand() : width;
      var subHeight = (this.dimName['y'] != null) ? this.scale['y'].rangeBand() : height;
      
      for(var i = 0 ; i < rangeX.length ; i++) {
        for(var j = 0 ; j < rangeY.length ; j++) {
          this.subSys.drawBackground(svg, dim, offsetX+rangeX[i], offsetY+rangeY[j], subWidth, subHeight);
        }
      }
    }
  };
  
  Rect.prototype.drawAxis = function(svg, dim, offsetX, offsetY, width, height) {
    // X axis
    if(this.dimName['x'] != null) {
      var xAxis = d3.svg.axis()
                  .scale(this.scale['x'])
                  .orient('bottom');
      
      if(!dim[this.dimName['x']].ordinal) {
        xAxis.ticks(5);
      }
      
      
      svg.append('g')
         .attr('class', 'axis')
         .attr('transform', 'translate('+offsetX+','+(offsetY+height)+')')
         .call(xAxis);
    }
                  
    // Y axis
    if(this.dimName['y'] != null) {
      var yAxis = d3.svg.axis()
                  .scale(this.scale['y'])
                  .orient('left');
      
      if(!dim[this.dimName['y']].ordinal) {
        yAxis.ticks(5);
      }
      
      svg.append('g')
         .attr('class', 'axis')
         .attr('transform', 'translate(' +offsetX+ ','+offsetY+')')
         .call(yAxis);
    }
    
    if(this.subSys != null) {
      var size = {x:width,
                  y:height};
      var range = {};
      var subSize = {};
      
      for(var i in this.dimName) {
        range[i] = (this.dimName[i] != null) ? this.scale[i].range() : [0];
        subSize[i] = (this.dimName[i] != null) ? this.scale[i].rangeBand() : size[i];
      }
      
      for(var i = 0 ; i < range['x'].length ; i++) {
        for(var j = 0 ; j < range['y'].length ; j++) {
          this.subSys.drawAxis(svg, dim, offsetX+range['x'][i], offsetY+range['y'][j], subSize['x'], subSize['y']);
        }
      }
    }
  };
  
  /////// POLAR ///////
  function Polar(param) {
    this.dimName = [];
    this.scale = [];
    this.boundary = [];
    for(var i = 0 ; i < Polar.prototype.dimName.length ; i++) {
      this.dimName[Polar.prototype.dimName[i]] = undefined;
      this.scale[Polar.prototype.dimName[i]] = null;
    }
    
    this.centerX = null;
    this.centerY = null;
    this.subSys = null;
    
    if(isUndefined(param)) {
      return;
    }
    
    for(var i in this.dimName) {
      var type = typeof param[i];
      if(type != 'undefined') {
        if(type != 'number' && type != 'string' && param[i] != null) {
          ERROR(errorParamMessage(lib_name+'.polar', i, type, '\'number\' or \'string\''));
        }
        else {
          this.dimName[i] = param[i];
        }
      }
    }
    
    if(isDefined(param.subSys) && !(param.subSys instanceof Rect) && !(param.subSys instanceof Polar)) {
      ERROR(errorParamMessage(lib_name+'.polar', 'subSys', typeof param.subSys, '\'Rect\' or \'Polar\''));
    }
    else {
      this.subSys = param.subSys;
    }
  };
  
  Polar.prototype.dimName = ['theta', 'radius'];
  
  Polar.prototype.computeScale = function(dim, width, height) {
    this.centerX = width / 2;
    this.centerY = height / 2;
    
    
    // Theta
    this.boundary['theta'] = {min:0, max:2*Math.PI};
    if(this.dimName['theta'] == null) {
    }
    else if(dim[this.dimName['theta']].ordinal) {
      var dom = dim[this.dimName['theta']].domain.slice();
      dom.push('');
      this.scale['theta'] = d3.scale.ordinal()
                      .domain(dom)
                      .rangePoints([0, 2 * Math.PI]);
      dim[this.dimName['theta']].band = (2 * Math.PI) / dim[this.dimName['theta']].domain.length;
    }
    else {
      this.scale['theta'] = d3.scale.linear()
                                    .domain(dim[this.dimName['theta']].domain)
                                    .range([0, 2*Math.PI]);
      dim[this.dimName['theta']].band = 2 * Math.PI / (this.scale['theta'].domain()[1] - this.scale['theta'].domain()[0]);
    }
    
    
    // Radius
    this.boundary['radius'] = {min:0, max:d3.min([width / 2, height / 2])};
    if(this.dimName['radius'] == null) {
    }
    else if(dim[this.dimName['radius']].ordinal) {
      this.scale['radius'] = d3.scale.ordinal()
                               .domain(dim[this.dimName['radius']].domain)
                               .rangePoints([0, this.boundary['radius'].max], 1);
      dim[this.dimName['radius']].band = this.boundary['radius'].max / dim[this.dimName['radius']].domain.length;
    }
    else {
      this.scale['radius'] = d3.scale.linear()
                      .domain(dim[this.dimName['radius']].domain)
                      .range([0, this.boundary['radius'].max])
                      .nice();
      dim[this.dimName['radius']].band = this.boundary['radius'].max / (this.scale['radius'].domain()[1] - this.scale['radius'].domain()[0]);
    }
  };
  
  Polar.prototype.getX = function(pos, d, i) {
    var theta = null;
    if(this.dimName['theta'] != null) {
      if(pos[this.dimName['theta']] != null) {
        theta = this.scale['theta'](pos[this.dimName['theta']](d, i))
      }
      else {
        theta = 0;
      }
    }
    else {
      theta = this.boundary['theta'].max / 2;
    }
    
    
    var radius = null;
    if(this.dimName['radius'] != null) {
      if(pos[this.dimName['radius']] != null) {
        radius = this.scale['radius'](pos[this.dimName['radius']](d, i))
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
    if(this.dimName['theta'] != null) {
      if(pos[this.dimName['theta']] != null) {
        theta = this.scale['theta'](pos[this.dimName['theta']](d, i))
      }
      else {
        theta = 0;
      }
    }
    else {
      theta = this.boundary['theta'].max / 2;
    }
    
    var radius = null;
    if(this.dimName['radius'] != null) {
      if(pos[this.dimName['radius']] != null) {
        radius = this.scale['radius'](pos[this.dimName['radius']](d, i))
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
  
  Polar.prototype.drawBackground = function(svg, dim, offsetX, offsetY, width, height) {
    var maxRadius = d3.min([width / 2, height / 2]);
    
    svg.append('g')
    .attr('class', 'background')
    .attr('transform', 'translate('+(offsetX+this.centerX)+','+(offsetY+this.centerY)+')')
    .append('circle')
    .attr('r', maxRadius)
    .attr('fill','orange')
    .attr('fill-opacity',0.3);
  };
  
  Polar.prototype.drawAxis = function(svg, dim, offsetX, offsetY, width, height) {
    var maxRadius = d3.min([width / 2, height / 2]);
    
    var axisNode = svg.append('g');
    axisNode.attr('class', 'axis')
            .attr('transform', 'translate(' +(offsetX+this.centerX)+ ','+(offsetY+this.centerY)+')');                     
    
    // Radius 'axis'
    if(this.dimName['radius'] != null) {
      var ticks;
      
      if(dim[this.dimName['radius']].ordinal) {
        ticks = this.scale['radius'].domain();
      }
      else {
        ticks = this.scale['radius'].ticks(5);
        var dom = this.scale['radius'].domain();
        ticks.push(dom[0]);
        ticks.push(dom[1]);
        RemoveDupArray(ticks);
      }
      
      for(var i = 0 ; i < ticks.length ; i++) {
        axisNode.append('circle')
                .attr('r', this.scale['radius'](ticks[i]) || 1)
                .attr('fill', 'none')
                .attr('stroke', 'black');
        
        axisNode.append('text')
                .text(ticks[i])
                .attr('x', this.scale['radius'](ticks[i]) + 5)
                .attr('y', -5)
                .attr('fill', 'black');
      }
    }
    
    // Theta axis
    if(this.dimName['theta'] != null) {
      var ticks;
      
      if(dim[this.dimName['theta']].ordinal) {
        ticks = this.scale['theta'].domain();
      }
      else {
        ticks = this.scale['theta'].ticks(8);
        var dom = this.scale['theta'].domain();
        //ticks.push(dom[0]);
        //ticks.push(dom[1]);
        //RemoveDupArray(ticks);
      }
      
      for(var i = 0 ; i < ticks.length ; i++) {
        var x = Math.cos(this.scale['theta'](ticks[i])) * maxRadius;
        var y = -Math.sin(this.scale['theta'](ticks[i])) * maxRadius;
        axisNode.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', x)
                .attr('y2', y)
                .attr('stroke', 'black');
        
        x = Math.cos(this.scale['theta'](ticks[i])) * (maxRadius + 15);
        y = -Math.sin(this.scale['theta'](ticks[i])) * (maxRadius + 15);
        var tick = (typeof ticks[i] === 'number') ? ticks[i].toFixed(2) : ticks[i].toString();
        axisNode.append('text')
                .text(tick)
                .attr('transform', 'translate('+x+','+y+')')
                .attr('text-anchor', 'middle')
                .attr('y', '.35em')
                .attr('fill', 'black');
      }
    }
  };
  
  
  ///////////////////////
  // Loading functions //
  ///////////////////////

  // Load data from a csv file
  main_object.loadFromFile = function(param) {
    var funcName = lib_name+'.loadFromFile';
    var filename = checkParam(funcName, param, 'file');
    
    var dl = new DataLoader();
    
    var xhr = d3.csv(filename)
                .row(processRow)
                .on('beforesend', function(xhr){
                  xhr.onprogress = getProgressListener(dl);
                })
    
    dl.sendXhrRequest = function() {
      xhr.get(this.load);
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
                .on('beforesend', function(xhr){
                  xhr.onprogress = getProgressListener(dl);
                })
                .response(function(request) {return d3.csv.parse(request.responseText, processRow)})
    
    dl.sendXhrRequest = function() {
      xhr.post(httpRequestParam, this.load);
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
    
    return function(data) {
      var filtered_data = [];
      for(var i = 0 ; i < data.length ; i++) {
        if(criteria(data[i], i)) {
          filtered_data.push(data[i]);
        }
      }
      return filtered_data;
    }
  }
  
  // Compute box plot data (quartiles, whiskers and outliers)
  main_object.computeBoxPlotStat = function(param) {
    var funcName = lib_name+'.computeBoxPlotStat';
    var group_by = checkParam(funcName, param, 'group_by');
    var stat_on = checkParam(funcName, param, 'stat_on');
    
    
    return function(data) {
      var groupByAes = [];
    
      // Aesthetics
      var aes = [];
      // Map data column name -> aesthetic id
      var dataCol2Aes = {};
      // Map function -> aesthetic id
      var func2Aes = {};
      // Map const value -> aesthetic id
      var const2Aes = {};
      
      // Sizes of each splits, sub-splits, etc
      var splitSizes = [];
      
      for(var i in group_by) {
        var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, group_by[i], main_dataset_name, 'group_by:'+i, funcName);
        groupByAes[i] = aes[aesId];
        computeDomain(groupByAes[i], data, 'discret');
        splitSizes.push(groupByAes[i].discretDomain.length);
      }
      
      var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, stat_on, main_dataset_name, 'stat_on', funcName);
      var statOnAes = aes[aesId];
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
        
        var values = [];
        for(var i = 0 ; i < dataSubset.length ; i++) {
          values.push(statOnAes.func(dataSubset[i], i));
        }
        values.sort(function(a, b){return a-b});
        
        
        var new_datum = {};
        for(var i in group_by) {
          new_datum[i] = groupByAes[i].func(dataSubset[0], 0);
        }
        new_datum.quartile1 = d3.quantile(values, 0.25);
        new_datum.quartile2 = d3.quantile(values, 0.50);
        new_datum.quartile3 = d3.quantile(values, 0.75);
        
        var IQR = new_datum.quartile3 - new_datum.quartile1;
        var min = values[0];
        var max = values[values.length-1];
        new_datum.whisker1 = Math.max(new_datum.quartile1 - 1.5*IQR, min);
        new_datum.whisker2 = Math.min(new_datum.quartile3 + 1.5*IQR, max);
        
        new_data.push(new_datum);
      }
      
      return new_data;
    };
  }
  
  /////////////////////
  // Popup functions //
  /////////////////////
  
  // Display a popup
  main_object.showPopup = function(param) {
    var funcName = lib_name+'.popup';
    var g =         checkParam(funcName, param, 'graphic');
    var id =        checkParam(funcName, param, 'id');
    var position =  checkParam(funcName, param, 'position', [0, 0]);
    var text =      checkParam(funcName, param, 'text',     '');
    var duration =  checkParam(funcName, param, 'duration', 0);
    
    var popup = g.svg.select('#pop-up-'+id.toString());
    var bgNode = null;
    var textNode = null;
    
    if(popup.empty()) {
      popup = g.svg.insert('g').attr('id', 'pop-up-'+id.toString());
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
    var funcName = lib_name+'.popdown';
    var g =         checkParam(funcName, param, 'graphic');
    var id =        checkParam(funcName, param, 'id');
    var duration =  checkParam(funcName, param, 'duration', 0);
    
    var popup = g.svg.select('#pop-up-'+id.toString());
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
    
    return !g.svg.select('#pop-up-'+id.toString()).empty();
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
  
  
  ////////////////////////
  // Interval functions //
  ////////////////////////
  
  main_object.interval = function(val1, val2) {
    return new Interval(val1, val2, false);
  };
  main_object.interval.stack = function(val, origin) {
    return new Interval(val, isUndefined(origin) ? 0 : origin, true);
  };
  
  function Interval(val1, val2, stacked) {
    this.boundary1 = {value:val1};
    this.boundary2 = {value:val2};
    this.stacked = stacked;
  }
  
  
  ////////////////////////////////
  // BoxPlot parameter function //
  ////////////////////////////////
  
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
    this.quartile1 = {value:q1};
    this.quartile2 = {value:q2};
    this.quartile3 = {value:q3};
    this.whisker1 = {value:w1};
    this.whisker2 = {value:w2};
  };
  
  main_object.boxplotStat = function(param) {
    return new BoxPlotStat(param);
  };
  
  function BoxPlotStat(v) {
    this.value = v;
  };
  
  
  ///////////////////////
  // Private functions //
  ///////////////////////
  
  // Data loader
  function DataLoader() {
    this.g = null;
    this.sendXhrRequest = null;
    var me = this;
    return {
      me:this,
      load:function (error, dataset) {
        me.g.svg.select('#loading-bar').remove();
        if(error != null) {
          ERROR(''+error.status+': '+error.statusText+'\n'+error.responseText);
        }
        
        me.g.onDataLoaded(dataset);
      }
    };
  };
  
  // Add an element to the graphic
  var addElement = function(g, Type, param, originFunc) {
    var elt = new Type;
    
    // copying attributes' values from the fallback element
    for(var attr in g.fallback_element.attrs) {
      if(isDefined(g.fallback_element.attrs[attr].type)) {
        elt.attrs[attr] = { type:        g.fallback_element.attrs[attr].type,
                            value:       g.fallback_element.attrs[attr].value,
                            originFunc:  g.fallback_element.attrs[attr].originFunc};
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
  var drawBox = function(node, deepestCoordSys, eltClass, getX, getY, bound1, bound2, limBound1, limBound2) {
    
    if(deepestCoordSys instanceof Rect) {
      // On enter
      var onEnter = node.enter().append('rect').attr('class', eltClass);
      
      onEnter.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
      onEnter.attr('x', bound1);
      onEnter.attr('y', bound2);
      onEnter.attr('width', limBound1);
      onEnter.attr('height', limBound2);
      
      // On update
      var onUpdate = node.transition();
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
          
          var datum = { startAngle:this._startAngle,
                        endAngle:this._endAngle,
                        innerRadius:this._innerRadius,
                        outerRadius:this._outerRadius};
            
          return arc(datum);
        });
      
      // On update
      var onUpdate = node.transition();
      onUpdate.attr('transform', function(d, i) {return 'translate('+getX(d, i)+','+getY(d, i)+')';});
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
          
          return function(t) {
            var datum = { startAngle:interpolStartAngle(t),
                          endAngle:interpolEndAngle(t),
                          innerRadius:interpolInnerRadius(t),
                          outerRadius:interpolOuterRadius(t)};
            
            return arc(datum);
          };
        });
    
      // On exit
      var onExit = node.exit();
      
      return {enter:onEnter, update:onUpdate, exit:onExit};
    }
  }
  
  // Draw a 'Segment' (Line or Arc)
  var drawSegment = function(node, deepestCoordSys, eltClass, getX, getY, bound1, bound2, limBound1, limBound2) {
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
      onUpdate = node.transition();
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
      onUpdate = node.transition();
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
            
            return function(t) {
              return draw_arc(interpolStartAngle(t), interpolEndAngle(t), interpolRadius(t));
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
    if(typeof a[0] === 'number') {
      a.sort(function(a, b){return a-b});
    }
    else {
      a.sort();
    }
    for (var i = 1; i < a.length; i++){
      if (a[i-1] === a[i]) {
        a.splice(i, 1);
        i--;
      }
    }
  };
  
  // Compute min and max of an Array after applying a function
  var extent = function(a, f){
    var ret = [Infinity, -Infinity];
    
    for(var i = 0 ; i < a.length ; i++) {
      var val = f(a[i], i);
      
      if(val < ret[0]) {
        ret[0] = val;
      }
      if(val > ret[1]) {
        ret[1] = val;
      }
    }
    
    return ret;
  }
  
  // Determinate on which dimension we have to force to ordinal scale
  var getDimensionsInfo = function(coordSystem, temporalDim) {
    var dim = [];
    var cs = coordSystem;
    
    while(cs != null) {
      for(var i in cs.dimName) {
        if(cs.dimName[i] != null) {
          dim[cs.dimName[i]] = {  isSpacial:true};
          
          // Force ordinal if the coordinate system have a sub coordinate system
          if(cs.subSys != null) {
            dim[cs.dimName[i]].forceOrdinal = true;
          }
          else {
            dim[cs.dimName[i]].forceOrdinal = false;
          }
        }
      }
      cs = cs.subSys;
    }
    
    for(var i in temporalDim) {
      dim[i] = {forceOrdinal:true,
                isSpacial:false};
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
    // Ordinal domain
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
        // Compute continuous domain from ordinal one
        if(isDefined(aes.discretDomain)) {
          var ordDom = aes.discretDomain;
          aes.continuousDomain = [ordDom[0], ordDom[ordDom.length-1]];
        }
        else {
          aes.continuousDomain = extent(dataset, aes.func);
        }
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
    return function(pe) {
      if(pe.lengthComputable) {
        var svg = dl.me.g.svg;
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
                                   .attr('fill', 'white')
          loadingBar.append('rect').attr('class', 'bar')
                                   .attr('x', margin)
                                   .attr('y', margin)
                                   .attr('width', 0)
                                   .attr('height', barHeight - margin * 2)
                                   .attr('fill', 'green');
        }
        var bar = loadingBar.select('.bar');
        
        bar.transition().attr('width', (barWidth - margin * 2) * (pe.loaded / pe.total));
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
  
  var LOG = function(msg) {
    if(console.log) {
      console.log(msg)
    }
  };
  
  var TIMER_BEGIN = function(name) {
    if(console.time) {
      console.time(name)
    }
  };
  
  var TIMER_END = function(name) {
    if(console.timeEnd) {
      console.timeEnd(name)
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
