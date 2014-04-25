!function() {
"use strict";
  
  var lib_name = 'd4';
  
  window[lib_name] = {
    version: '0.2'
  };
  
  // Some constants
  var data_binding_prefix = 'data:';
  var temp_dim_attr_prefix = 't';
  var ordinal_scale_padding = 1;
  var linear_scale_padding = 0.1;
  var coordSysMargin = 0.15;
  
  
  // Elements definition
  var ElementBase = function() {
    this.name =             'ElementBase';
    this.position =         { type:'position',
                              value:null};
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
  };
    
  var Symbol = function() {
    this.name =   'Symbol';
    this.type = { type:'symbol',
                    value:'circle'};
    this.size = { type:'number',
                    value:null};
  };
  
  var Line = function() {
    this.name = 'Line';
    this.interpolation = {type:'string',
                          value:'linear'};
    /* Possible values :
     * linear - piecewise linear segments, as in a polyline.
     * linear-closed - close the linear segments to form a polygon.
     * step - alternate between horizontal and vertical segments, as in a step function.
     * step-before - alternate between vertical and horizontal segments, as in a step function.
     * step-after - alternate between horizontal and vertical segments, as in a step function.
     * basis - a B-spline, with control point duplication on the ends.
     * basis-open - an open B-spline; may not intersect the start or end.
     * basis-closed - a closed B-spline, as in a loop.
     * bundle - equivalent to basis, except the tension parameter is used to straighten the spline.
     * cardinal - a Cardinal spline, with control point duplication on the ends.
     * cardinal-open - an open Cardinal spline; may not intersect the start or end, but will intersect other control points.
     * cardinal-closed - a closed Cardinal spline, as in a loop.
     * monotone - cubic interpolation that preserves monotonicity in y.
     */
    
    this.stroke_linecap = {type:'string',
                           value:'butt'};
    /* Possible values :
     * butt
     * round
     * square
     */  
  };
  
  
  // Create a new graphic
  window[lib_name].graphic = function(args) {
    return new Graphic(args);
  }
  
  // Graphic definition
  var Graphic = function() {
    this.spacialCoord = new Rect({x:1, y:2});
    this.temporalCoord = new Temp();
    this.dataset = null;
    this.dataLoader = null;
    this.elements = [];
    this.fallback_element = new ElementBase();
    
    // attribute non null only after render
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
    
    if(!isUndefined(param)) {
      for(var attr in this.fallback_element) {
        if(!isUndefined(param[attr])) {
          this.fallback_element[attr].value = param[attr];
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
  
  // Set dataset
  Graphic.prototype.data = function(data) {
    if(data === null) {
      throw 'Setting data to null';
    }
    else if(data instanceof Array) {
      this.dataset = data;
    }
    // Value from the file loading function
    else {
      data.me.g = this;
      this.dataLoader = data;
    }
    
    return this;
  }
  
  // Set spacial coordinate system (Rect({x:1, y:2}) by default)
  Graphic.prototype.coord = function(coordSys) {
    if(isUndefined(coordSys)) {
      this.spacialCoord = new Rect({x:1, y:2});
    }
    else {
      this.spacialCoord = coordSys;
      
      while(coordSys != null) {
        if(coordSys instanceof Polar && coordSys.subSys != null) {
          throw 'Impossible to have a sub coordinate system in a Polar system'
        }
        else{
          coordSys = coordSys.subSys;
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
    if(this.dataset === null) {
      return this;
    }
    
    var selector = 'body';
    var width = 640;
    var height = 360;
    this.margin = { left:20,
                    top:20,
                    right:20,
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
    
    LOG("Ready to plot: selector={0}, width={1}, height={2}".format(
          selector,
          width,
          height));
    LOG("Margin: left={0}, right={1}, top={2}, bottom={3}".format(
          this.margin.left,
          this.margin.right,
          this.margin.top,
          this.margin.bottom));
    
    /*                                               *\
     * Standardization of aesthetics                 *
     * Collecting some informations about dimentions *
    \*                                               */
    
    // Information on each dimention
    this.dim = getDimentionsInfo(this.spacialCoord, this.temporalCoord);
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
        // Skip uninteresting attributes and non-set attributes
        if(isUndefined(this.elements[i][attr].type) ||
           this.elements[i][attr].value === null) {
          continue;
        }
        
        var attr_type = this.elements[i][attr].type;
        var attr_val = this.elements[i][attr].value;
        
        if(attr_type == 'position') {
          // Positions are bound with several aesthetics (one per dimention) 
          if(!attr_val instanceof Array)
            throw errorMessage(this.elements[i].name, attr, typeof attr_val, '\'Array\'');
          
          this.elements[i][attr].aes = new Array(attr_val.length);
          for(var j = 0 ; j < attr_val.length ; j++) {
            // Get the aestetic id
            var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val[j]);
            
            // Check data type return by this aesthetic
            var aes_ret_type = typeof aes[aesId].func(this.dataset[0]);
            if(aes_ret_type != 'number' && aes_ret_type != 'string')
              throw errorMessage(this.elements[i].name, attr+'['+j+']', aes_ret_type, '\'number\' or \'string\'');
            
            this.elements[i][attr].aes[j] = aes[aesId];
            if(isUndefined(this.dim[j].aes))
              this.dim[j].aes = [];
              
            this.dim[j].aes.push(aes[aesId]);
          }
        }
        else {
          // Get the aestetic id
          var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val);
          
          // Check data type return by this aesthetic
          var aes_ret_type = typeof aes[aesId].func(this.dataset[0]);
          switch(attr_type) {
            case 'color':
              if(aes_ret_type != 'number' && aes_ret_type != 'string') {
                throw errorMessage(this.elements[i].name, attr, aes_ret_type, 'color (\'number\' or \'string\')');
              }
              break;
            case 'symbol':
              if(aes_ret_type != 'number' && aes_ret_type != 'string') {
                throw errorMessage(this.elements[i].name, attr, aes_ret_type, 'symbol (\'number\' or \'string\')');
              }
              break;
            case 'string':
              if(aes_ret_type != 'number' && aes_ret_type != 'string') {
                throw errorMessage(this.elements[i].name, attr, aes_ret_type, '\'string\' (\'number\' accepted)');
              }
              break;
            case 'number':
              if(aes_ret_type != 'number') {
                throw errorMessage(this.elements[i].name, attr, aes_ret_type, '\'number\'');
              }
              break;
          }
          
          this.elements[i][attr].aes = aes[aesId];
        }
      }
    }
    
    // Aesthetics of temporal dimensions
    for(var i = 0 ; i < this.temporalCoord.value.length ; i++) {
      // Get the aestetic id
      var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, this.temporalCoord.value[i]);
      
      // Check data type return by this aesthetic
      var aes_ret_type = typeof aes[aesId].func(this.dataset[0]);
      if(aes_ret_type != 'number' && aes_ret_type != 'string') {
        throw errorMessage('Temp', temp_dim_attr_prefix+(i+1), aes_ret_type, '\'number\' or \'string\'');
      }
      // There is one and only one aesthetic per temporal dimention
      this.dim[this.temporalCoord.dimId[i]].aes = [aes[aesId]];
    }
    
    // We don't need those variables anymore
    aes = undefined;
    dataCol2Aes = undefined;
    func2Aes = undefined;
    const2Aes = undefined;
    
    
    /*                               *\
     * Computing dimentions' domains *
    \*                               */
    for(var i = 0 ; i < this.dim.length ; i++) {
      if(isUndefined(this.dim[i].aes))
        throw 'Error: dimention '+(i+1)+' unused';
      
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
    
    // Splitting data according to temporal dimentions
    this.splitTempDimId = [];
    for(var i = 0 ; i < this.dim.length ; i++) {
      // Split
      if(!this.dim[i].isSpacial) {
        this.splitTempDimId.push(i);
        splitSizes.push(this.dim[i].domain.length);
      }
    }
    
    // Splitting data according to spacial dimentions
    splitSizes.push(this.elements.length);
    this.splitSpacialDimId = [];
    for(var i = 0 ; i < this.dim.length ; i++) {
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
    
    // add Canvas
    this.svg = d3.select(selector)
                .append("svg")
                .attr("width", width)
                .attr("height", height);
    
    
    // Add axis
    this.spacialCoord.drawAxis( this.svg,
                                this.dim,
                                this.margin.left,
                                this.margin.top,
                                width-this.margin.left-this.margin.right,
                                height-this.margin.top-this.margin.bottom);
                                
    // Drawn elements
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
      // Compute 'getX' and 'getY' functions
      var pos;
      if(typeof this.elements[i].position.value === null) {
        // TODO: default value (first value of discret domain or min of continue one)
      }
      else {
        pos = new Array(this.elements[i].position.aes.length);
        for(var j = 0 ; j < pos.length ; j++)
          pos[j] = this.elements[i].position.aes[j].func;
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
            
            if(this.elements[i].type.value != null)
              symbol.type(this.elements[i].type.func);
              
            if(this.elements[i].size.value != null)
              symbol.size(this.elements[i].size.func);
            
            var node = this.svg.selectAll('.'+eltClass)
                           .data(dataSubset);
            
            // On enter
            var onEnter = node.enter().append('path').attr('class', eltClass);
            svgSetCommonAttributesPerElem(onEnter, this.elements[i]);
            onEnter.attr('transform', function(d) {return 'translate('+getX(d)+','+getY(d)+')';});
            onEnter.attr('d', symbol);
            
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
  
  window[lib_name].rect = function(args) {
    return new Rect(args);
  };
  
  window[lib_name].polar = function(args) {
    return new Polar(args);
  };
  
  /////// CARTESIAN ///////
  var Rect = function(param) {
    this.dimId = [null,   // [0] : x
                  null];  // [1] : y
    this.subSys = null;
    this.scaleX = null;
    this.scaleY = null;
    
    if(isUndefined(param)) {
      return;
    }
    
    var type = typeof param.x;
    if(type != 'undefined') {
      if(type != 'number') {
        throw errorMessage('Rect', 'x', type, '\'positive integer\'');
      }
      else {
        this.dimId[0] = param.x-1;
      }
    }
    
    type = typeof param.y;
    if(type != 'undefined') {
      if(type != 'number') {
        throw errorMessage('Rect', 'y', type, '\'positive integer\'');
      }
      else {
        this.dimId[1] = param.y-1;
      }
    }
    
    var type = typeof param.subSys;
    if(type != 'undefined') {
      if(type != 'object') {
        throw errorMessage('Rect', 'subSys', type, '\'Rect\' or \'Polar\'');
      }
      else {
        this.subSys = param.subSys;
      }
    }
  };
    
  Rect.prototype.computeScale = function(dim, width, height) {
    // X scale
    var subWidth = null;
    var subHeight = null;
    
    if(this.dimId[0] === null) {
      subWidth = width;
    }
    else if(this.subSys != null) {
      this.scaleX = d3.scale.ordinal()
                      .domain(dim[this.dimId[0]].domain)
                      .rangeRoundBands([0, width], coordSysMargin);
      subWidth = this.scaleX.rangeBand();
    }
    else if(dim[this.dimId[0]].ordinal) {
      this.scaleX = d3.scale.ordinal()
                      .domain(dim[this.dimId[0]].domain)
                      .rangePoints([0, width], ordinal_scale_padding);
    }
    else {
      this.scaleX = d3.scale.linear()
                      .domain(addPadding(dim[this.dimId[0]].domain, linear_scale_padding))
                      .range([0, width])
                      .nice();
    }
    
    // Y scale
    if(this.dimId[1] === null) {
      subHeight = height;
    }
    else if(this.subSys != null) {
      this.scaleY = d3.scale.ordinal()
                      .domain(dim[this.dimId[1]].domain)
                      .rangeRoundBands([height, 0], coordSysMargin);
      subHeight = this.scaleY.rangeBand();
    }
    else if(dim[this.dimId[1]].ordinal) {
      this.scaleY = d3.scale.ordinal()
                      .domain(dim[this.dimId[1]].domain)
                      .rangePoints([height, 0], ordinal_scale_padding);
    }
    else {
      this.scaleY = d3.scale.linear()
                      .domain(addPadding(dim[this.dimId[1]].domain, linear_scale_padding))
                      .range([height, 0])
                      .nice();
    }
    
    // Sub coordinate system scale
    if(this.subSys != null) {
      this.subSys.computeScale(dim, subWidth, subHeight);
    }
  };
    
  Rect.prototype.getX = function(pos, d) {
    var X = (this.dimId[0] != null) ? this.scaleX(pos[this.dimId[0]](d)) : 0;
    
    if(this.subSys != null) {
      X += this.subSys.getX(pos, d);
    }
    
    return X;
  },
  
  Rect.prototype.getY = function(pos, d) {
    var Y = (this.dimId[1] != null) ? this.scaleY(pos[this.dimId[1]](d)) : 0;
    
    if(this.subSys != null) {
      Y += this.subSys.getY(pos, d);
    }
    
    return Y;
  };
    
  Rect.prototype.drawAxis = function(svgNode, dim, offsetX, offsetY, width, height) {
    //*//TODO remove
    svgNode.append('g')
    .attr("transform", 'translate('+offsetX+','+offsetY+')')
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill","orange")
    .attr("fill-opacity",0.3);
    //*/
    
    // X axis
    if(this.dimId[0] != null) {
      var xAxis = d3.svg.axis()
                  .scale(this.scaleX)
                  .orient('bottom');
      
      if(!dim[this.dimId[0]].ordinal) {
        xAxis.ticks(5);
      }
      
      
      svgNode.append('g')
             .attr('class', 'axis')
             .attr('transform', 'translate('+offsetX+','+(offsetY+height)+')')
             .call(xAxis);
    }
                  
    // Y axis
    if(this.dimId[1] != null) {
      var yAxis = d3.svg.axis()
                  .scale(this.scaleY)
                  .orient('left');
      
      if(!dim[this.dimId[1]].ordinal) {
        yAxis.ticks(5);
      }
      
      svgNode.append('g')
             .attr('class', 'axis')
             .attr('transform', 'translate(' +offsetX+ ','+offsetY+')')
             .call(yAxis);
    }
    
    if(this.subSys != null) {
      var rangeX = (this.dimId[0] != null) ? this.scaleX.range() : [0];
      var rangeY = (this.dimId[1] != null) ? this.scaleY.range() : [0];
      var subWidth = (this.dimId[0] != null) ? this.scaleX.rangeBand() : width;
      var subHeight = (this.dimId[1] != null) ? this.scaleY.rangeBand() : height;
      
      for(var i = 0 ; i < rangeX.length ; i++) {
        for(var j = 0 ; j < rangeY.length ; j++) {
          this.subSys.drawAxis(svgNode, dim, offsetX+rangeX[i], offsetY+rangeY[j], subWidth, subHeight);
        }
      }
    }
  };
  
  /////// POLAR ///////
  var Polar = function(param) {
    this.dimId = [null,   // [0] : theta
                  null];  // [1] : radius
    this.centerX = null;
    this.centerY = null;
    this.scaleT = null;
    this.scaleR = null;
    this.subSys = null;
    
    if(isUndefined(param)) {
      return;
    }
    
    var type = typeof param.theta;
    if(type != 'undefined') {
      if(type != 'number') {
        throw errorMessage('Rect', 'theta', type, '\'positive integer\'');
      }
      else {
        this.dimId[0] = param.theta-1;
      }
    }
    
    type = typeof param.radius;
    if(type != 'undefined') {
      if(type != 'number') {
        throw errorMessage('Rect', 'radius', type, '\'positive integer\'');
      }
      else {
        this.dimId[1] = param.radius-1;
      }
    }
    
    var type = typeof param.subSys;
    if(type != 'undefined') {
      if(type != 'object' || !param.subSys instanceof CoordSys) {
        throw errorMessage('Rect', 'subSys', type, '\'Rect\' or \'Polar\'');
      }
      else {
        this.subSys = param.subSys;
      }
    }
  };
    
  Polar.prototype.computeScale = function(dim, width, height) {
    this.centerX = width / 2;
    this.centerY = height / 2;
    
    // Theta
    if(dim[this.dimId[0]].ordinal) {
      var dom = dim[this.dimId[0]].domain;
      dom.push('');
      this.scaleT = d3.scale.ordinal()
                      .domain(dim[this.dimId[0]].domain)
                      .rangePoints([0, 2 * Math.PI]);
    }
    else {
      this.scaleT = d3.scale.linear()
                      .domain(dim[this.dimId[0]].domain)
                      .range([0, 2*Math.PI]);
    }
    
    // Radius
    var radiusMax = d3.min([width / 2, height / 2]);
    if(dim[this.dimId[1]].ordinal) {
      this.scaleR = d3.scale.ordinal()
                      .domain(dim[this.dimId[1]].domain)
                      .rangePoints([0, radiusMax], ordinal_scale_padding);
    }
    else {
      this.scaleR = d3.scale.linear()
                      .domain(dim[this.dimId[1]].domain)
                      .range([0, radiusMax])
                      .nice();
    }
  };
    
  Polar.prototype.getX = function(pos, d) {
    var theta = (this.dimId[0] != null) ? this.scaleT(pos[this.dimId[0]](d)) : 2*Math.PI;
    var radius = (this.dimId[1] != null) ? this.scaleR(pos[this.dimId[1]](d)) : this.centerX / 2;
    
    return this.centerX + Math.cos(theta) * radius;
  },
  
  Polar.prototype.getY = function(pos, d) {
    var theta = (this.dimId[0] != null) ? this.scaleT(pos[this.dimId[0]](d)) : 2*Math.PI;
    var radius = (this.dimId[1] != null) ? this.scaleR(pos[this.dimId[1]](d)) : this.centerX / 2;
    
    return this.centerY - Math.sin(theta) * radius;
  };
  
  Polar.prototype.drawAxis = function(svgNode, dim, offsetX, offsetY, width, height) {
    var maxRadius = d3.min([width / 2, height / 2]);
    
    //*//TODO remove
    svgNode.append('g')
    .attr('transform', 'translate('+(offsetX+this.centerX)+','+(offsetY+this.centerY)+')')
    .append('circle')
    .attr('r', maxRadius)
    .attr('fill','orange')
    .attr('fill-opacity',0.3);
    //*/
    
    var axisNode = svgNode.append('g');
    axisNode.attr('class', 'axis')
            .attr('transform', 'translate(' +(offsetX+this.centerX)+ ','+(offsetY+this.centerY)+')');                     
    
    // Radius 'axis'
    if(this.dimId[1] != null) {
      var ticks;
      
      if(dim[this.dimId[1]].ordinal) {
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
    if(this.dimId[0] != null) {
      var ticks;
      
      if(dim[this.dimId[0]].ordinal) {
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
        
        x = Math.cos(this.scaleT(ticks[i])) * (maxRadius + 20);
        y = -Math.sin(this.scaleT(ticks[i])) * (maxRadius + 20);
        var tick = (typeof ticks[i] === 'number') ? ticks[i].toFixed(2) : ticks[i].toString();
        axisNode.append('text')
                .text(tick)
                .attr('text-anchor', 'middle')
                .attr('x', x)
                .attr('y', y)
                .attr('fill', 'black');
      }
    }
  };
  
  /////// TEMPORAL ///////
  var Temp =  function(param) {
    this.dimId = [];
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
  window[lib_name].loadFromFile = function(filename) {
    
    var Closure = function () {
      this.g = null;
      this.plotParam = null;
      var me = this;
      return {
        me:this,
        action:function (error, dataset) {
          // TODO: handle errors
          
          me.g.data(dataset);
          
          if(me.plotParam != null) {
            me.g.render(me.plotParam);
          }
        }
      };
    }
    
    var closure = new Closure();
    
    d3.csv(filename)
    .row(processRow)
    .get(closure.action);
    
    return closure;
  }


  // Load data from a database
  window[lib_name].loadFromDatabase = function(param) {
    var host = 'localhost';
    var dbname = null;
    var user = null;
    var pwd = null;
    var request = null;
    
    if(isUndefined(param)) {
      throw 'Error in '+lib_name+'.loadFromDatabase: Missing parameters';
    }
    else if(isUndefined(param.dbname)) {
      throw 'Error in '+lib_name+'.loadFromDatabase: Missing parameters \'dbname\'';
    }
    else if(isUndefined(param.user)) {
      throw 'Error in '+lib_name+'.loadFromDatabase: Missing parameters \'user\'';
    }
    else if(isUndefined(param.pwd)) {
      throw 'Error in '+lib_name+'.loadFromDatabase: Missing parameters \'pwd\'';
    }
    else if(isUndefined(param.request)) {
      throw 'Error in '+lib_name+'.loadFromDatabase: Missing parameters \'request\'';
    }
    else if(!isUndefined(param.request)) {
      host = param.host;
    }
    
    dbname = param.dbname;
    user = param.user;
    pwd = param.pwd;
    request = param.request;
    
    var Closure = function () {
      this.g = null;
      this.plotParam = null;
      var me = this;
      return {
        me:this,
        action:function (error, dataset) {
          // TODO: handle errors
          
          me.g.data(dataset);
          
          if(me.plotParam != null) {
            me.g.render(me.plotParam);
          }
          
        }
      };
    }
    
    var closure = new Closure();
    
    var httpRequestParam = 'host='+host+'&dbname='+dbname+'&user='+user+'&pwd='+pwd+'&request='+request;
    
    d3.xhr('http://localhost')
    .header("Content-Type", "application/x-www-form-urlencoded")
    .response(function(request) {return d3.csv.parse(request.responseText, processRow)})
    .post(httpRequestParam, closure.action)
    
    return closure;
  }

  
  ///////////////////////
  // Private functions //
  ///////////////////////
  
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
    
    if(!isUndefined(param)) {
      for(var attr in elt) {
        if(!isUndefined(param[attr]) &&
           !isUndefined(elt[attr]) && !isUndefined(elt[attr].type)) {
          if(attr == 'pos')
            elt[attr].value = param[attr].slice();
          else
            elt[attr].value = param[attr];
        }
      }
    }
    g.elements.push(elt);
  }
  
  // Set an svg attribute (each element have its value)
  function svgSetAttributePerElem(node, svgAttr, elt, attr) {
    if(elt[attr].value != null) {
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
    if(elt[attr].value != null) {
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
  
  
  // Compute some stats (min and max only for now)
  function computeStat(dataset, f) {  
    var min_max = d3.extent(dataset, f);
    
    return {min:min_max[0], max:min_max[1]}
  }
  
  // Generate an error message
  function errorMessage(elt_name, attribute, type, expected) {
    return elt_name+'.'+attribute+' don\'t support value of type \''+type+
           '\'; Expected: '+expected;
  }
  
  // Determinate on which dimention we have to force to ordinal scale
  function getDimentionsInfo(coordSystem, tempCoord) {
    var dim = [];
    var cs = coordSystem;
    
    while(cs != null) {
      for(var i = 0 ; i < cs.dimId.length ; i++) {
        if(cs.dimId[i] != null) {
          // Force ordinal if the coordinate system have a sub coordinate system
          if(cs.subSys != null) {
            dim[cs.dimId[i]] = {forceOrdinal:true,
                              isSpacial:true};
          }
          else {
            dim[cs.dimId[i]] = {forceOrdinal:false,
                              isSpacial:true};
          }
        }
      }
      cs = cs.subSys;
    }
    
    for(var i = 0 ; i < tempCoord.value.length ; i++) {
      dim.push({forceOrdinal:true,
                isSpacial:false});
      tempCoord.dimId.push(dim.length-1);
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
        
        aes.push({func:toFunction(column)});
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
      throw 'Error: attribute bind to a \''+typeof attr_val+'\'';
      
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
          var stat = computeStat(dataset, aes.func);
          aes.continuousDomain = [stat.min, stat.max];
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
  
  
  var ASSERT = function(condition, msg) {
    if(!condition) {
      throw 'ASSERTION false: '.concat(msg)
    }
  }
  
  var LOG = function(msg) {
    
    if ( window.console && window.console.log ) {
      console.log(msg)
    }
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
    
    if(this.dataLoader != null) {
      this.dataLoader.me.plotParam = param;
      return this;
    }
    
    // debugger
    var theGraphic = this;
    window.addEventListener("load", function() { theGraphic.render(param); }, true);
    
    return this;
  };
}();

