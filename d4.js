!function() {
"use strict";
  
  var lib_name = 'd4';
  
  var main_object = {
    version: '0.3'
  };
  window[lib_name] = main_object;
  
  // Some constants
  var data_binding_prefix = 'data:';
  var temp_dim_attr_prefix = 't';
  var ordinal_scale_padding = 1;
  var linear_scale_padding = 0.1;
  var coordSysMargin = 0.15;
  
  
  // Elements definition
  var ElementBase = function() {
    this.name =             'ElementBase';
    this.group =            { type:'string',
                              value:'1'};
    this.fill =             { type:'color',
                              value:null};
    this.fill_opacity =     { type:'number',
                              value:null};
    this.stroke_width =     { type:'number',
                              value:null};
    this.stroke =           { type:'color',
                              value:null};
    this.stroke_dasharray = { type:'string',
                              value:null};
    this.stroke_opacity =   { type:'number',
                              value:null};
                              
    this.listeners = [];
  };
    
  var Symbol = function() {
    this.name =   'Symbol';
    this.type = { type:'symbol',
                    value:'circle'};
    this.size = { type:'number',
                    value:null};
                    
    this.listeners = [];
  };
  
  var Line = function() {
    this.name = 'Line';
    this.interpolation = {type:'string',
                          value:'linear'};
    this.stroke_linecap = {type:'string',
                           value:'butt'};
     
     this.listeners = [];
  };
  
  
  // Create a new graphic
  main_object.graphic = function(args) {
    return new Graphic(args);
  }
  
  // Graphic definition
  var Graphic = function() {
    this.spacialCoord = null;
    this.spacialDimName = null;
    this.coord();
    this.temporalCoord = new Temp();
    this.dataset = null;
    this.dataLoader = null;
    this.elements = [];
    this.fallback_element = new ElementBase();
    this.lastElementAdded = this.fallback_element;
    
    // Attributes used by onDataLoad method
    this.render_param = null;
    this.data_filter = null;
    
    // Attributes non null only after render
    this.margin = null;
    this.svg = null;
    this.nestedData = null;
    this.currentTime = null;
    this.splitTempDimId = null;
    this.splitSpacialDimId = null;
    this.dim = null;
  }
  
  // Set element properties
  Graphic.prototype.element = function(param) {
    this.fallback_element = new ElementBase();
    this.lastElementAdded = this.fallback_element;
    
    if(!isUndefined(param)) {
      for(var attr in param) {
        if(!isUndefined(this.fallback_element[attr])) {
          this.fallback_element[attr].value = param[attr];
        }
        else {
          this.fallback_element[attr] = { type:'unknown',
                                          value:param[attr]};
        }
      }
    }

    return this;
  }
  
  
  // Add circles
  Graphic.prototype.symbol = function(param) {
    addElement(this, Symbol, param);
    
    return this;
  }
  
  
  // Add lines
  Graphic.prototype.line = function(param) {
    addElement(this, Line, param);
    
    return this;
  }
  
  // Set listener
  Graphic.prototype.on = function(type, listener) {
    this.lastElementAdded.listeners[type] = listener;
    
    return this;
  }
  
  // Set dataset
  Graphic.prototype.data = function(data, filter) {
    if(data === null) {
      ERROR('Setting data to null');
    }

    if(!isUndefined(filter)) {
      this.data_filter = filter;
    }
    
    if(data instanceof Array) {
      this.onDataLoaded(data);
    }
    // Value from the file loading function
    else {
      this.dataLoader = data;
      data.me.g = this;
    }
    
    return this;
  }
  
  
  // Set data just loaded, filter them and render if needed;
  // Not supposed to be called by the user
  Graphic.prototype.onDataLoaded = function(data) {
    if(this.data_filter != null) {
      this.dataset = data.filter(this.data_filter);
      this.data_filter = null;
    }
    else {
      this.dataset = data;
    }
    
    if(this.render_param != null) {
      var param = this.render_param;
      this.render_param = null;
      this.render(param);
    }
  }
  
  
  // Set spacial coordinate system (Rect({x:'x', y:'y'}) by default)
  Graphic.prototype.coord = function(coordSys) {
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
  }
  
  // Set temporal coordinate system (none by default)
  Graphic.prototype.time = function(temporalCoord) {
    if(isUndefined(temporalCoord)) {
      this.temporalCoord = new Temp();
    }
    else {
      this.temporalCoord = new Temp(temporalCoord);
    }
    
    return this;
  }
  
  // Go to the next value of the specified time dimension
  Graphic.prototype.nextStep = function(timeDimension) {
    if(isUndefined(timeDimension) || this.currentTime === null ||
      timeDimension < 1 || timeDimension > this.currentTime.length) {
      return this;
    }
    
    if(this.currentTime[timeDimension-1] < this.dim[this.splitTempDimId[timeDimension-1]].domain.length-1){
      this.currentTime[timeDimension-1]++;
      this.update();
    }
    
    return this;
  }
  
  // Go to the previous value of the specified time dimension
  Graphic.prototype.previousStep = function(timeDimension) {
    if(isUndefined(timeDimension) || this.currentTime === null ||
      timeDimension < 1 || timeDimension > this.currentTime.length) {
      return this;
    }
    
    if(this.currentTime[timeDimension-1] > 0){
      this.currentTime[timeDimension-1]--;
      this.update();
    }
    
    return this;
  }

  // Render the graphic in svg
  Graphic.prototype.render = function(param) {
    var selector = 'body';
    var width = 640;
    var height = 360;
    this.margin = { left:30,
                    top:10,
                    right:10,
                    bottom:20};
    
    // Check parameters
    if(!isUndefined(param)) {
      if(!isUndefined(param.selector)) {
        selector = param.selector;
      }
      if(!isUndefined(param.width)) {
        width = param.width;
      }
      if(!isUndefined(param.height)) {
        height = param.height;
      }
      if(!isUndefined(param.margin)) {
        this.margin.left = this.margin.top = this.margin.right = this.margin.bottom = param.margin;
      }
      if(!isUndefined(param.margin_left)) {
        this.margin.left = param.margin_left;
      }
      if(!isUndefined(param.margin_top)) {
        this.margin.top = param.margin_top;
      }
      if(!isUndefined(param.margin_right)) {
        this.margin.right = param.margin_right;
      }
      if(!isUndefined(param.margin_bottom)) {
        this.margin.bottom = param.margin_bottom;
      }
    }
    
    // Reserve the place for the graphic while loading
    // Add Canvas
    if(this.svg === null) {
      this.svg = d3.select(selector)
                   .append("svg")
                   .attr("width", width)
                   .attr("height", height);
    }
    
    if(this.dataset === null) {
      this.render_param = param;
      return this;
    }
    
    LOG("Ready to plot: selector={0}, width={1}, height={2}".format(
          selector,
          width,
          height));
    LOG("Margin: left={0}, right={1}, top={2}, bottom={3}".format(
          this.margin.left,
          this.margin.right,
          this.margin.top,
          this.margin.bottom));
    
    
    /*                                              *\
     * Detection of attributes which are dimensions *
     * Deletion of useless attributes               *
    \*                                              */
    
    // Aesthetics of elements
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i]) {
        // Skip uninteresting attributes typed attributes
        if(isUndefined(this.elements[i][attr].type)) {
          continue;
        }
        
        // This attribute is a dimension
        if(this.spacialDimName.indexOf(attr) >= 0) {
          this.elements[i][attr].type = 'dimension';
        }
        
        // Useless attribute
        if(this.elements[i][attr].type === 'unknown' ||
           this.elements[i][attr].value === null) {
          delete this.elements[i][attr];
        }
      }
    }
    
    
    /*                                               *\
     * Standardization of aesthetics                 *
     * Collecting some informations about dimensions *
    \*                                               */
    
    // Information on each dimension
    this.dim = getDimensionsInfo(this.spacialCoord, this.temporalCoord);
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
      for(var attr in this.elements[i]) {
        // Skip uninteresting attributes
        if(isUndefined(this.elements[i][attr].type)) {
          continue;
        }
        
        var attr_type = this.elements[i][attr].type;
        var attr_val = this.elements[i][attr].value;
        
        // Get the aestetic id
        var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val);
        
        // Check data type return by this aesthetic
        var aes_ret_type = typeof aes[aesId].func(this.dataset[0]);
        switch(attr_type) {
          case 'dimension':
            if(aes_ret_type != 'number' && aes_ret_type != 'string') {
              ERROR(errorMessage(this.elements[i].name, attr, aes_ret_type, 'position (\'number\' or \'string\')'));
            }
            if(isUndefined(this.dim[attr].aes)) {
              this.dim[attr].aes = [];
            }
            this.dim[attr].aes.push(aes[aesId]);
            break;
          case 'color':
            if(aes_ret_type != 'number' && aes_ret_type != 'string') {
              ERROR(errorMessage(this.elements[i].name, attr, aes_ret_type, 'color (\'number\' or \'string\')'));
            }
            break;
          case 'symbol':
            if(aes_ret_type != 'number' && aes_ret_type != 'string') {
              ERROR(errorMessage(this.elements[i].name, attr, aes_ret_type, 'symbol (\'number\' or \'string\')'));
            }
            break;
          case 'string':
            if(aes_ret_type != 'number' && aes_ret_type != 'string') {
              ERROR(errorMessage(this.elements[i].name, attr, aes_ret_type, '\'string\' (\'number\' accepted)'));
            }
            break;
          case 'number':
            if(aes_ret_type != 'number') {
              ERROR(errorMessage(this.elements[i].name, attr, aes_ret_type, '\'number\''));
            }
            break;
        }
        
        this.elements[i][attr].aes = aes[aesId];
      }
    }
    
    // Aesthetics of temporal dimensions
    for(var i = 0 ; i < this.temporalCoord.value.length ; i++) {
      // Get the aestetic id
      var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, this.temporalCoord.value[i]);
      
      // Check data type return by this aesthetic
      var aes_ret_type = typeof aes[aesId].func(this.dataset[0]);
      if(aes_ret_type != 'number' && aes_ret_type != 'string') {
        ERROR(errorMessage('Temp', temp_dim_attr_prefix+(i+1), aes_ret_type, '\'number\' or \'string\''));
      }
      // There is one and only one aesthetic per temporal dimension
      this.dim[this.temporalCoord.dimName[i]].aes = [aes[aesId]];
    }
    
    // We don't need those variables anymore
    aes = undefined;
    dataCol2Aes = undefined;
    func2Aes = undefined;
    const2Aes = undefined;
    
    
    /*                               *\
     * Computing dimensions' domains *
    \*                               */
    
    for(var i in this.dim) {
      if(isUndefined(this.dim[i].aes))
        ERROR('Error: dimension '+i+' unused');
      
      var domain;
      var ordinal;
      
      if(this.dim[i].forceOrdinal)
        ordinal = true;
      else {
        // Don't force ordinal (i.e. continue if only number values)
        var ordinal = false;
        for(var j = 0 ; j < this.dim[i].aes.length ; j++) {
          if(typeof this.dim[i].aes[j].func(this.dataset[0]) != 'number') {
            ordinal = true;
            break;
          }
        }
      }
      
      // Ordinal domain
      if(ordinal) {
        domain = [];
        for(var j = 0 ; j < this.dim[i].aes.length ; j++) {
          // Compute discret domain
          computeDomain(this.dim[i].aes[j], this.dataset, 'discret');
          var dom = this.dim[i].aes[j].ordinalDomain;;
          
          for(var k = 0 ; k < dom.length ; k++)
            domain.push(dom[k]);
        }
        RemoveDupArray(domain);
      }
      // Continue domain
      else {
        domain = [Infinity, -Infinity];
        for(var j = 0 ; j < this.dim[i].aes.length ; j++) {
          // Compute continuous domain
          computeDomain(this.dim[i].aes[j], this.dataset, 'continuous');
          var dom = this.dim[i].aes[j].continuousDomain;
          
          if(dom[0] < domain[0])
            domain[0] = dom[0];
          if(dom[1] > domain[1])
            domain[1] = dom[1];
        }
        
        if(domain[0] == domain[1]) {
          domain = addPadding(domain, linear_scale_padding);
        }
      }
      
      this.dim[i].domain = domain;
      this.dim[i].ordinal = ordinal;
    }
    
    
    /*                  *\
     * Computing scales *
    \*                  */
    
    // For the coordinate system
    this.spacialCoord.computeScale( this.dim, 
                                    width - this.margin.left - this.margin.right,
                                    height - this.margin.top - this.margin.bottom);
    
    // For other attributes
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i]) {
        // Skip uninteresting attributes and non-set attributes
        if(isUndefined(this.elements[i][attr].type) ||
           this.elements[i][attr].value === null ||
           this.elements[i][attr].type === 'position') {
          continue;
        }
        
        var attr_type = this.elements[i][attr].type;
        var attr_aes = this.elements[i][attr].aes;
        var aes_ret_type = typeof attr_aes.func(this.dataset[0]);
        
        
        switch(attr_type) {
          case 'color':
            if(aes_ret_type === 'string') {
              // No scaling
              this.elements[i][attr].func = attr_aes.func;
            }
            else {
              // Compute continuous domain
              computeDomain(attr_aes, this.dataset, 'continuous');
              
              // Scaling
              var scale = d3.scale.category10().domain(attr_aes.continuousDomain);
              
              this.elements[i][attr].func = scale.compose(attr_aes.func);
            }
            break;
          
          case 'symbol':
            if(aes_ret_type === 'string') {
              // No scaling
              this.elements[i][attr].func = attr_aes.func;
            }
            else {
              // Compute discret domain
              computeDomain(attr_aes, this.dataset, 'discret');
              
              // Scaling
              var scale = d3.scale.ordinal()
                                  .domain(attr_aes.ordinalDomain)
                                  .range(d3.svg.symbolTypes);
              
              this.elements[i][attr].func = scale.compose(attr_aes.func);
            }
            break;
          
          case 'string':
            // No scaling
            if(aes_ret_type === 'string') {
              this.elements[i][attr].func = attr_aes.func;
            }
            else { // Just apply toString
              var applyToString = function (f) {
                return function (d) {
                  return f(d).toString();
                }
              };
              this.elements[i][attr].func = applyToString(attr_aes.func);
            }
            break;
          
          case 'number':
            // No scaling
            this.elements[i][attr].func = attr_aes.func;
            break;
        }
      }
    }
    
    
    /*                *\
     * Splitting data *
    \*                */
    
    // Sizes of each splits, sub-splits, etc
    var splitSizes = [];
    
    // Splitting data according to temporal dimensions
    this.splitTempDimId = [];
    for(var i = 0 ; i < this.dim.length ; i++) {
      // Split
      if(!this.dim[i].isSpacial) {
        this.splitTempDimId.push(i);
        splitSizes.push(this.dim[i].domain.length);
      }
    }
    
    // Splitting data according to spacial dimensions
    splitSizes.push(this.elements.length);
    this.splitSpacialDimId = [];
    for(var i in this.dim) {
      // Split
      if(this.dim[i].isSpacial && this.dim[i].forceOrdinal) {
        this.splitSpacialDimId.push(i);
        splitSizes.push(this.dim[i].domain.length);
      }
    }
    
    // Splitting data according to group
    var groupSizes = [];
    for(var i = 0 ; i < this.elements.length ; i++) {
      computeDomain(this.elements[i].group.aes, this.dataset, 'discret');
      groupSizes.push(this.elements[i].group.aes.ordinalDomain.length);
    }
    
    
    this.nestedata = allocateSplitDataArray(splitSizes, 0);
    
    var values = [];
    for(var i = 0 ; i < this.dataset.length ; i++) {
      var dataTempSubset = this.nestedata;
      for(var j = 0 ; j < this.splitTempDimId.length ; j++) {
        // There is only one aesthetic per temporal dimension
        var value = this.dim[this.splitTempDimId[j]].aes[0].func(this.dataset[i]);
        var id = this.dim[this.splitTempDimId[j]].domain.indexOf(value);
        dataTempSubset = dataTempSubset[id];
      }
      
      for(var j = 0 ; j < this.elements.length ; j++) {
        var dataSpacialSubset = dataTempSubset[j];
        for(var k = 0 ; k < this.splitSpacialDimId.length ; k++) {
          // There is only one aesthetic per temporal dimension
          var value = this.dim[this.splitSpacialDimId[k]].aes[j].func(this.dataset[i]);
          var id = this.dim[this.splitSpacialDimId[k]].domain.indexOf(value);
          dataSpacialSubset = dataSpacialSubset[id];
        }
        
        if(dataSpacialSubset.length == 0) {
          for(var k = 0 ; k < groupSizes[j] ; k++) {
            dataSpacialSubset.push([]);
          }
        }
        
        var value = this.elements[j].group.aes.func(this.dataset[i]);
        var id = this.elements[j].group.aes.ordinalDomain.indexOf(value);
        
        dataSpacialSubset[id].push(this.dataset[i]);
      }
    }
    
    // Initialising current 'time' (i.e. position in spacial dimensions)
    this.currentTime = [];
    for(var i = 0 ; i < this.splitTempDimId.length ; i++) {
      this.currentTime.push(0);
    }
    
    /*                *\
     * Generating svg *
    \*                */
    
    // Add background
    //*
    this.spacialCoord.drawBackground( this.svg,
                                      this.dim,
                                      this.margin.left,
                                      this.margin.top,
                                      width-this.margin.left-this.margin.right,
                                      height-this.margin.top-this.margin.bottom);
    //*/
    
    // Add axis
    //*
    this.spacialCoord.drawAxis( this.svg,
                                this.dim,
                                this.margin.left,
                                this.margin.top,
                                width-this.margin.left-this.margin.right,
                                height-this.margin.top-this.margin.bottom);
    //*/
    
    // Draw elements
    this.update();
    
    return this;
  }
  
  
  // (Re)draw elements of the graphics
  Graphic.prototype.update = function() {
    // Data belonging to the current time
    var dataToDisplay = this.nestedata;
    for(var i = 0 ; i < this.currentTime.length ; i++) {
      dataToDisplay = dataToDisplay[this.currentTime[i]];
    }
    
    
    // Draw elements
    for(var i = 0 ; i < this.elements.length ; i++) {
      /*                                     *\
       * Compute 'getX' and 'getY' functions *
      \*                                     */
      var pos = [];
      
      for(var j in this.dim) {
        if(this.dim[j].isSpacial) {
          if(isUndefined(this.elements[i][j])) {
            // TODO: default value (first value of discret domain or min of continue one)
          }
          else {
            pos[j] = this.elements[i][j].aes.func;
          }
        }
      }
      
      // getX
      var Closure = function (cs, p, ml) {
        return function (d) {
          return ml + cs.getX(p, d);
        }
      };
      var getX = Closure(this.spacialCoord, pos, this.margin.left);
      
      // getY
      Closure = function (cs, p, mt) {
        return function (d) {
          return mt + cs.getY(p, d);
        }
      };
      var getY = Closure(this.spacialCoord, pos, this.margin.top);
      
      
      // Initilasing current position
      var currentPos = [];
      for(var j = 0 ; j < this.splitSpacialDimId.length ; j++) {
        currentPos.push(0);
      }
      
      var complete = false;
      
      while(!complete) {
        var dataSubset = dataToDisplay[i];
        for(var j = 0 ; j < currentPos.length ; j++) {
          dataSubset = dataSubset[currentPos[j]];
        }
        
        var dataSubsetCopy = dataSubset;
        var groupSize = this.elements[i].group.aes.ordinalDomain.length;
        for(var j = 0 ; j < groupSize ; j++) {
          dataSubset = dataSubsetCopy[j];
          
          var eltClass = 'etl'+i;
          for(var k = 0 ; k < currentPos.length ; k++) {
            eltClass += currentPos[k];
          }
          eltClass +=j
          
          // Set attributes for each kind of elements
          // Symbol
          if(this.elements[i].name == 'Symbol') {
            var symbol = d3.svg.symbol();
            
            if(!isUndefined(this.elements[i].type))
              symbol.type(this.elements[i].type.func);
              
            if(!isUndefined(this.elements[i].size))
              symbol.size(this.elements[i].size.func);
            
            var node = this.svg.selectAll('.'+eltClass)
                           .data(dataSubset);
            
            // On enter
            var onEnter = node.enter().append('path').attr('class', eltClass);
            
            svgSetCommonAttributesPerElem(onEnter, this.elements[i]);
            onEnter.attr('transform', function(d) {return 'translate('+getX(d)+','+getY(d)+')';});
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
            onUpdate.attr('transform', function(d) {return 'translate('+getX(d)+','+getY(d)+')';});
            node.attr('d', symbol); // Transition bug here...
          }
          
          // Lines
          else if(this.elements[i].name == 'Line') {
            var interpolation;
            if(dataSubset.length > 0)
              interpolation = this.elements[i].interpolation.func(dataSubset[0], 0);
            else
              interpolation = '';
            
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
              svgSetCommonAttributesPerGroup(node, this.elements[i], dataSubset[0]);
              svgSetAttributePerGroup(node, 'stroke-linecap', this.elements[i], 'stroke_linecap', dataSubset[0]);
            }
            else {
              svgSetCommonAttributesPerGroup(node, this.elements[i], null);
              svgSetAttributePerGroup(node, 'stroke-linecap', this.elements[i], 'stroke_linecap', null);
            }
            
            // Nothing to do on exit, there will just be an empty path
          }
        }
        
        var j = 0;
        while(true) {
          if(j >= currentPos.length) {
            complete = true;
            break;
          }
          
          currentPos[j]++;
          if(currentPos[j] >= this.dim[this.splitSpacialDimId[j]].domain.length) {
            currentPos[j] = 0;
            j++;
          }
          else {
            break;
          }
        }
      }
    }
    return this;
  }
  
  
  ////////////////////////
  // Coordonate Systems //
  ////////////////////////
  
  main_object.rect = function(args) {
    return new Rect(args);
  };
  
  main_object.polar = function(args) {
    return new Polar(args);
  };
  
  // TODO:  Rect.prototype.dimName = ['x', 'y']
  //        this.dimName[0] -> this.dim['x']
  
  /////// CARTESIAN ///////
  var Rect = function(param) {
    this.dimName = [];
    this.scale = [];
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
          ERROR(errorMessage('Rect', i, type, '\'number\' or \'string\''));
        }
        else {
          this.dimName[i] = param[i];
        }
      }
    }
    
    if(!param.subSys instanceof Rect && !param.subSys instanceof Polar) {
      ERROR(errorMessage('Rect', 'subSys', type, '\'Rect\' or \'Polar\''));
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
      
      if(this.dimName[i] === null) {
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
      }
      else {
        this.scale[i] = d3.scale.linear()
                        .domain(addPadding(dim[this.dimName[i]].domain, linear_scale_padding))
                        .range(ranges[i])
                        .nice();
      }
    }
    
    // Sub coordinate system scale
    if(this.subSys != null) {
      this.subSys.computeScale(dim, subSize['x'], subSize['y']);
    }
  };
    
  Rect.prototype.getX = function(pos, d) {
    var X = (this.dimName['x'] != null) ? this.scale['x'](pos[this.dimName['x']](d)) : 0;
    
    if(this.subSys != null) {
      X += this.subSys.getX(pos, d);
    }
    
    return X;
  };
  
  Rect.prototype.getY = function(pos, d) {
    var Y = (this.dimName['y'] != null) ? this.scale['y'](pos[this.dimName['y']](d)) : 0;
    
    if(this.subSys != null) {
      Y += this.subSys.getY(pos, d);
    }
    
    return Y;
  };
  
  Rect.prototype.drawBackground = function(svgNode, dim, offsetX, offsetY, width, height) {
    svgNode.append('g')
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
          this.subSys.drawBackground(svgNode, dim, offsetX+rangeX[i], offsetY+rangeY[j], subWidth, subHeight);
        }
      }
    }
  }
  
  Rect.prototype.drawAxis = function(svgNode, dim, offsetX, offsetY, width, height) {
    // X axis
    if(this.dimName['x'] != null) {
      var xAxis = d3.svg.axis()
                  .scale(this.scale['x'])
                  .orient('bottom');
      
      if(!dim[this.dimName['x']].ordinal) {
        xAxis.ticks(5);
      }
      
      
      svgNode.append('g')
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
      
      svgNode.append('g')
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
          this.subSys.drawAxis(svgNode, dim, offsetX+range['x'][i], offsetY+range['y'][j], subSize['x'], subSize['y']);
        }
      }
    }
  };
  
  /////// POLAR ///////
  var Polar = function(param) {
    this.dimName = [];
    this.scale = [];
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
          ERROR(errorMessage('Polar', i, type, '\'number\' or \'string\''));
        }
        else {
          this.dimName[i] = param[i];
        }
      }
    }
    
    if(!param.subSys instanceof Rect && !param.subSys instanceof Polar) {
      ERROR(errorMessage('Polar', 'subSys', type, '\'Rect\' or \'Polar\''));
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
    if(dim[this.dimName['theta']].ordinal) {
      var dom = dim[this.dimName['theta']].domain.slice();
      dom.push('');
      this.scaleT = d3.scale.ordinal()
                      .domain(dom)
                      .rangePoints([0, 2 * Math.PI]);
    }
    else {
      this.scaleT = d3.scale.linear()
                      .domain(dim[this.dimName['theta']].domain)
                      .range([0, 2*Math.PI]);
    }
    
    // Radius
    var radiusMax = d3.min([width / 2, height / 2]);
    if(dim[this.dimName['radius']].ordinal) {
      this.scaleR = d3.scale.ordinal()
                      .domain(dim[this.dimName['radius']].domain)
                      .rangePoints([0, radiusMax], ordinal_scale_padding);
    }
    else {
      this.scaleR = d3.scale.linear()
                      .domain(dim[this.dimName['radius']].domain)
                      .range([0, radiusMax])
                      .nice();
    }
  };
    
  Polar.prototype.getX = function(pos, d) {
    var theta = (this.dimName['theta'] != null) ? this.scaleT(pos[this.dimName['theta']](d)) : 2*Math.PI;
    var radius = (this.dimName['radius'] != null) ? this.scaleR(pos[this.dimName['radius']](d)) : this.centerX / 2;
    
    return this.centerX + Math.cos(theta) * radius;
  },
  
  Polar.prototype.getY = function(pos, d) {
    var theta = (this.dimName['theta'] != null) ? this.scaleT(pos[this.dimName['theta']](d)) : 2*Math.PI;
    var radius = (this.dimName['radius'] != null) ? this.scaleR(pos[this.dimName['radius']](d)) : this.centerX / 2;
    
    return this.centerY - Math.sin(theta) * radius;
  };
  
  Polar.prototype.drawBackground = function(svgNode, dim, offsetX, offsetY, width, height) {
    var maxRadius = d3.min([width / 2, height / 2]);
    
    svgNode.append('g')
    .attr('class', 'background')
    .attr('transform', 'translate('+(offsetX+this.centerX)+','+(offsetY+this.centerY)+')')
    .append('circle')
    .attr('r', maxRadius)
    .attr('fill','orange')
    .attr('fill-opacity',0.3);
  }
  
  Polar.prototype.drawAxis = function(svgNode, dim, offsetX, offsetY, width, height) {
    var maxRadius = d3.min([width / 2, height / 2]);
    
    var axisNode = svgNode.append('g');
    axisNode.attr('class', 'axis')
            .attr('transform', 'translate(' +(offsetX+this.centerX)+ ','+(offsetY+this.centerY)+')');                     
    
    // Radius 'axis'
    if(this.dimName['radius'] != null) {
      var ticks;
      
      if(dim[this.dimName['radius']].ordinal) {
        ticks = this.scaleR.domain();
      }
      else {
        ticks = this.scaleR.ticks(5);
        var dom = this.scaleR.domain();
        ticks.push(dom[0]);
        ticks.push(dom[1]);
        RemoveDupArray(ticks);
      }
      
      for(var i = 0 ; i < ticks.length ; i++) {
        axisNode.append('circle')
                .attr('r', this.scaleR(ticks[i]) || 1)
                .attr('fill', 'none')
                .attr('stroke', 'black');
        
        axisNode.append('text')
                .text(ticks[i])
                .attr('x', this.scaleR(ticks[i]) + 5)
                .attr('y', -5)
                .attr('fill', 'black');
      }
    }
    
    // Theta axis
    if(this.dimName['theta'] != null) {
      var ticks;
      
      if(dim[this.dimName['theta']].ordinal) {
        ticks = this.scaleT.domain();
      }
      else {
        ticks = this.scaleT.ticks(8);
        var dom = this.scaleT.domain();
        //ticks.push(dom[0]);
        //ticks.push(dom[1]);
        //RemoveDupArray(ticks);
      }
      
      for(var i = 0 ; i < ticks.length ; i++) {
        var x = Math.cos(this.scaleT(ticks[i])) * maxRadius;
        var y = -Math.sin(this.scaleT(ticks[i])) * maxRadius;
        axisNode.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', x)
                .attr('y2', y)
                .attr('stroke', 'black');
        
        x = Math.cos(this.scaleT(ticks[i])) * (maxRadius + 15);
        y = -Math.sin(this.scaleT(ticks[i])) * (maxRadius + 15);
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
  
  /////// TEMPORAL ///////
  var Temp =  function(param) {
    this.dimName = [];
    this.value = [];
    
    if(isUndefined(param)) {
      return;
    }
    
    for(var attr in param) {
      if(attr.indexOf(temp_dim_attr_prefix) != 0) {
        continue;
      }
      var ind = parseInt(attr.substring(temp_dim_attr_prefix.length)) - 1;
      if(isNaN(ind)) {
        continue;
      }
      
      this.value[ind] = param[attr];
    }
  };
  

  // Load data from a csv file
  main_object.loadFromFile = function(filename) {
    var dl = new DataLoader();
    
    var progressListener = function(pe) {
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
    
    d3.csv(filename)
    .row(processRow)
    .on('beforesend', function(xhr){
      xhr.onprogress = progressListener;
    })
    .get(dl.load);
    
    return dl;
  }


  // Load data from a database
  main_object.loadFromDatabase = function(param) {
    var host = 'localhost';
    var dbname = null;
    var user = null;
    var pwd = null;
    var request = null;
    
    if(isUndefined(param)) {
      ERROR('Error in '+lib_name+'.loadFromDatabase: Missing parameters');
    }
    else if(isUndefined(param.dbname)) {
      ERROR('Error in '+lib_name+'.loadFromDatabase: Missing parameter \'dbname\'');
    }
    else if(isUndefined(param.user)) {
      ERROR('Error in '+lib_name+'.loadFromDatabase: Missing parameter \'user\'');
    }
    else if(isUndefined(param.pwd)) {
      ERROR('Error in '+lib_name+'.loadFromDatabase: Missing parameter \'pwd\'');
    }
    else if(isUndefined(param.request)) {
      ERROR('Error in '+lib_name+'.loadFromDatabase: Missing parameter \'request\'');
    }
    else if(!isUndefined(param.request)) {
      host = param.host;
    }
    
    dbname = param.dbname;
    user = param.user;
    pwd = param.pwd;
    request = param.request;
    
    var dl = new DataLoader();
    
    var httpRequestParam = 'host='+host+'&dbname='+dbname+'&user='+user+'&pwd='+pwd+'&request='+request;
    
    d3.xhr('http://localhost')
    .header('Content-Type', 'application/x-www-form-urlencoded')
    .response(function(request) {return d3.csv.parse(request.responseText, processRow)})
    .post(httpRequestParam, dl.load);
    
    return dl;
  }
  
  // Display a popup
  main_object.popup = function(param) {
    var g = null;
    var id = null;
    var position = [0, 0];
    var text = '';
    
    if(!isUndefined(param)) {
      if(!isUndefined(param.position)) {
        position = param.position;
      }
      if(!isUndefined(param.text)) {
        text = param.text;
      }
      if(!isUndefined(param.graphic)) {
        g = param.graphic;
      }
      if(!isUndefined(param.id)) {
        id = param.id;
      }
    }
    
    if(g === null) {
      ERROR(lib_name+'.popup(): parameter graphic undefined');
    }
    else if(id === null) {
      ERROR(lib_name+'.popup(): parameter id undefined');
    }
    
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
                                   .attr('opacity', '0.5');
      textNode = popup.insert('text').attr('x', '10')
                                     .attr('y', '20');
    }
    else {
      bgNode = popup.select('rect');
      textNode = popup.select('text');
    }
    
    // Interrupt and cancel transition if any
    bgNode.interrupt().transition();
    textNode.interrupt().transition();
    
    popup.attr('transform', 'translate('+position[0]+','+position[1]+')');
    textNode.attr('opacity', '1')
            .text(text);
    var textDOM = textNode.node();
    bgNode.attr('opacity', '0.7')
          .attr('width', textDOM.clientWidth + 20)
          .attr('height', textDOM.clientHeight + 15);
  }
  
  // Hide a pop-up
  main_object.popdown = function(param) {
    var g = null;
    var id = null;
    var duration = 500;
    
    if(!isUndefined(param)) {
      if(!isUndefined(param.graphic)) {
        g = param.graphic;
      }
      if(!isUndefined(param.id)) {
        id = param.id;
      }
      if(!isUndefined(param.duration)) {
        duration = param.duration;
      }
    }
    
    if(g === null) {
      ERROR(lib_name+'.popdown(): parameter graphic undefined');
    }
    else if(id === null) {
      ERROR(lib_name+'.popdown(): parameter id undefined');
    }
    
    var popup = g.svg.select('#pop-up-'+id.toString());
    popup.select('rect').transition().duration(duration).attr('opacity', '0');
    popup.select('text').transition().duration(duration).attr('opacity', '0')
    // Callback at the end of the transition
      .each("end", function() {
          popup.remove();
        });
  }
  
  main_object.mouse = function(g) {
    return d3.mouse(g.svg.node());
  }
  
  
  // Return if a pop-up exist with a  given id exist or not
  main_object.popupExist = function(param) {
    var g = null;
    var id = null;
    
    if(!isUndefined(param)) {
      if(!isUndefined(param.graphic)) {
        g = param.graphic;
      }
      if(!isUndefined(param.id)) {
        id = param.id;
      }
    }
    
    if(g === null) {
      ERROR(lib_name+'.popdown(): parameter graphic undefined');
    }
    else if(id === null) {
      ERROR(lib_name+'.popdown(): parameter id undefined');
    }
    
    return !g.svg.select('#pop-up-'+id.toString()).empty();
  }

  
  ///////////////////////
  // Private functions //
  ///////////////////////
  
  // 
  var DataLoader = function () {
    this.g = null;
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
  }
  
  // Add an element to the graphic
  function addElement(g, Type, param) {
    var elt = new Type;
    
    // copying attributes' values from the fallback element
    for(var attr in g.fallback_element) {
      if(!isUndefined(g.fallback_element[attr].type)) {
        elt[attr] = {type:g.fallback_element[attr].type,
                     value:g.fallback_element[attr].value};
      }
    }
    for(var event in g.fallback_element.listeners) {
      elt.listeners[event] = g.fallback_element.listeners[event];
    }
    
    if(!isUndefined(param)) {
      for(var attr in param) {
        if(!isUndefined(elt[attr])) {
          elt[attr].value = param[attr];
        }
        else {
          elt[attr] = { type:'unknown',
                        value:param[attr]};
        }
      }
    }
    g.elements.push(elt);
    g.lastElementAdded = elt;
  }
  
  // Set an svg attribute (each element have its value)
  function svgSetAttributePerElem(node, svgAttr, elt, attr) {
    if(!isUndefined(elt[attr])) {
      node.attr(svgAttr, elt[attr].func);
    }
  }
  
  // Set common svg attribute (each element have its value)
  function svgSetCommonAttributesPerElem(node, elt) {
    svgSetAttributePerElem(node, 'stroke-width',     elt, 'stroke_width');
    svgSetAttributePerElem(node, 'stroke',           elt, 'stroke');
    svgSetAttributePerElem(node, 'stroke-dasharray', elt, 'stroke_dasharray');
    svgSetAttributePerElem(node, 'stroke-opacity',   elt, 'stroke_opacity');
    svgSetAttributePerElem(node, 'fill',             elt, 'fill');
    svgSetAttributePerElem(node, 'fill-opacity',     elt, 'fill_opacity');
  }
  
  // Set an svg attribute (element of the same group have the same value)
  function svgSetAttributePerGroup(node, svgAttr, elt, attr, datum) {
    if(!isUndefined(elt[attr])) {
      node.attr(svgAttr, elt[attr].func(datum));
    }
  }
  
  // Set common svg attribute (element of the same group have the same value)
  function svgSetCommonAttributesPerGroup(node, elt, datum) {
    svgSetAttributePerGroup(node, 'stroke-width',     elt, 'stroke_width',     datum);
    svgSetAttributePerGroup(node, 'stroke',           elt, 'stroke',           datum);
    svgSetAttributePerGroup(node, 'stroke-dasharray', elt, 'stroke_dasharray', datum);
    svgSetAttributePerGroup(node, 'stroke-opacity',   elt, 'stroke_opacity',   datum);
    svgSetAttributePerGroup(node, 'fill',             elt, 'fill',             datum);
    svgSetAttributePerGroup(node, 'fill-opacity',     elt, 'fill_opacity',     datum);
  }
  
  // Add padding to a continue interval
  function addPadding(interval, padding) {
    if(interval[0] != interval[1]) {
      return [interval[0] - (interval[1] - interval[0]) * padding,
              interval[1] + (interval[1] - interval[0]) * padding];
    }
    else if(interval[0] != 0) {
      return [0, interval[0] * 2];
    }
    else {
      return [-1, 1];
    }
  }
  
  // Remove duplicate value of an Array
  function RemoveDupArray(a){
    a.sort();
    for (var i = 1; i < a.length; i++){
      if (a[i-1] === a[i]) {
        a.splice(i, 1);
        i--;
      }
    }
  }
  
  
  // Generate an error message
  function errorMessage(elt_name, attribute, type, expected) {
    return elt_name+'.'+attribute+' don\'t support value of type \''+type+
           '\'; Expected: '+expected;
  }
  
  // Determinate on which dimension we have to force to ordinal scale
  function getDimensionsInfo(coordSystem, tempCoord) {
    var dim = [];
    var cs = coordSystem;
    
    while(cs != null) {
      for(var i in cs.dimName) {
        if(cs.dimName[i] != null) {
          // Force ordinal if the coordinate system have a sub coordinate system
          if(cs.subSys != null) {
            dim[cs.dimName[i]] = {forceOrdinal:true,
                                  isSpacial:true};
          }
          else {
            dim[cs.dimName[i]] = {forceOrdinal:false,
                                  isSpacial:true};
          }
        }
      }
      cs = cs.subSys;
    }
    
    for(var i = 0 ; i < tempCoord.value.length ; i++) {
      dim.push({forceOrdinal:true,
                isSpacial:false});
      tempCoord.dimName.push(dim.length-1);
    }
    
    return dim;
  }
  
  // get aesthetic id from an attribute
  function getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val) {
    var id;
    
    // If the attribute is bind to an aestetic
    if(typeof attr_val === 'string' && attr_val.indexOf(data_binding_prefix) == 0) {
      var column = attr_val.substring(data_binding_prefix.length);
      
      if(isUndefined(dataCol2Aes[column]))
      {
        // We convert it into a fonction
        var toFunction = function (c) {
          return function (d) {
            return d[c];
          }
        };
        
        aes.push({func:toFunction(column)
                ,column:column
                });
        id = aes.length - 1;
        dataCol2Aes[column] = id;
      }
      else
        id = dataCol2Aes[column];
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
                  constant:attr_val,
                  // We set the domains while we know it's a constant value
                  ordinalDomain:[attr_val]});
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
      if(isUndefined(func2Aes[attr_val]))
      {
        aes.push({func:attr_val});
        id = aes.length - 1;
        func2Aes[attr_val] = id;
      }
      else
        id = func2Aes[attr_val];
    }
    else
      ERROR('Error: attribute bind to a \''+typeof attr_val+'\'');
      
    return id;
  }
  
  
  // Compute domains of an aestetic
  function computeDomain(aes, dataset, type) {
    // Ordinal domain
    if(type == 'discret') {
      if(isUndefined(aes.ordinalDomain)) {
        var f = aes.func;
        aes.ordinalDomain = [];
        for(var k = 0 ; k < dataset.length ; k++) {
          aes.ordinalDomain.push(f(dataset[k]));
        }
        RemoveDupArray(aes.ordinalDomain);
      }
    }
    // Continue domain
    else {
      if(isUndefined(aes.continuousDomain)) {
        // Compute continuous domain from ordinal one
        if(!isUndefined(aes.ordinalDomain)) {
          var ordDom = aes.ordinalDomain;
          aes.continuousDomain = [ordDom[0], ordDom[ordDom.length-1]];
        }
        else {
          aes.continuousDomain = d3.extent(dataset, aes.func);
        }
      }
    }
  }
  
  // Allocate split data array
  function allocateSplitDataArray(splitSizes, id) {
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
  }
  
  function processRow(d) {
    for(var key in d) {
      var value = +d[key];
      if(!isNaN(value)) {
        d[key] = value;
      }
    }
    return d;
  }
  
  function ABORT() {
    throw 'Abort';
  }
  
  function ERROR(msg) {
      console.error('Error: '+msg);
      ABORT();
  }
  
  function WARNING(msg) {
    console.warn(msg);
  }
  
  var ASSERT = function(condition, msg) {
    console.assert(condition, msg);
    if(!condition) {
      ABORT();
    }
  }
  
  var LOG = function(msg) {
    console.log(msg)
  }
  
  function isUndefined(a) {
    return typeof a === 'undefined';
  }
  
  
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
  
  /* The function to render the plot                     */
  /* Automatically attaches itself to the window.onLoad  */
  /* Options are: width (optional), height (optional), margin (margin), selector (mandatory) */
  /* From: http://stackoverflow.com/questions/6348494/addeventlistener-vs-onclick            */
  Graphic.prototype.plot = function(param) {
    ASSERT(this.render, "No function render in this; how am I  supposed to render ??");
    
    // debugger
    var theGraphic = this;
    window.addEventListener("load", function() { theGraphic.render(param); }, true);
    
    return this;
  };
}();

