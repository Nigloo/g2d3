!function() {
"use strict";
  
  var d4 = {
    version: '0.1'
  };
  
  // Some constants
  var data_binding_prefix = 'data:';
  var ordinal_scale_padding = 1;
  var linear_scale_padding = 0.1;
  var coordSysMargin = 0.2;
  
  
  // Definiting the base constructor for all classes, which will execute the final class prototype's initialize method if exists
  var Class = function() {
      this.initialize && this.initialize.apply(this, arguments);
  };
  Class.extend = function(childPrototype) { // Defining a static method 'extend'
    var parent = this;
    var child = function() { // The child constructor is a call to its parent's
      return parent.apply(this, arguments);
    };
    child.extend = parent.extend; // Adding the extend method to the child class
    var Surrogate = function() {}; // Surrogate "trick"
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;
    for(var key in childPrototype){
      child.prototype[key] = childPrototype[key];
    }
    return child; // Returning the child class
  };
  
  // Elements definition
  var Element = Class.extend({
    initialize : function() {
      this.name =             'Element';
      this.position =         { type:'position',
                                value:null};
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
     }
  });
    
  var Circle = Element.extend({
    initialize : function() {
      this.name =   'Circle';
      this.radius = { type:'number',
                      value:null};
     }
  });
  
  var Line = Element.extend({
    initialize : function() {
      this.name = 'Line';
      this.interpolation = {type:'string',
                            value:'linear'}; // TODO: null ?
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
                             value:'butt'}; // TODO: null ?
    /* Possible values :
     * butt
     * round
     * square
     */  
     }
  });
  
  
  // Graphic definition
  window.Graphic = function() {
    this.coordSys = new Rect({x:1, y:2});
    this.dataset = null;
    this.elements = [];
    
    this.fallback_element = new Element();
  }
  
  // Set element properties
  Graphic.prototype.element = function(param) {
    this.fallback_element = new Element();
    
    if(typeof param != 'undefined') {
      for(var attr in this.fallback_element) {
        if(typeof param[attr] != 'undefined') {
          this.fallback_element[attr].value = param[attr];
        }
      }
    }

    return this;
  }
  
  
  // Add circles
  Graphic.prototype.circle = function(param) {
    addElement(this, Circle, param);
    
    return this;
  }
  
  
  // Add lines
  Graphic.prototype.line = function(param) {
    addElement(this, Line, param);
    
    return this;
  }
  
  // Set dataset
  Graphic.prototype.data = function(data) {
    this.dataset = data;
    
    return this;
  }
  
  // Set coordonate system (Rect({x:1, y:2}) by default)
  Graphic.prototype.coord = function(coordSys) {
    if(typeof coordSys === 'undefined') {
      return this.coordSys;
    }
    else if(!coordSys instanceof CoordSys) {
      throw errorMessage('Graphic', 'coord', typeof coordSys, '\'Rect\' or \'Polar\'');
    }
    else {
      this.coordSys = coordSys;
      
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

  // Render the graphic in svg
  Graphic.prototype.render = function(param) {
    if(this.dataset == null) {
      throw 'No dataset';
    }
    
    var selector = 'body',
        width = 640,
        height = 360,
        margin = {left:10,
                  top:10,
                  right:10,
                  bottom:10};
    
    // Check parameters
    if(typeof param != 'undefined') {
      if(typeof param.selector != 'undefined') {
        selector = param.selector;
      }
      if(typeof param.width != 'undefined') {
        width = param.width;
      }
      if(typeof param.height != 'undefined') {
        height = param.height;
      }
      if(typeof param.margin != 'undefined') {
        margin.left = margin.top = margin.right = margin.bottom = param.margin;
      }
      if(typeof param.margin_left != 'undefined') {
        margin.left = param.margin_left;
      }
      if(typeof param.margin_top != 'undefined') {
        margin.top = param.margin_top;
      }
      if(typeof param.margin_right != 'undefined') {
        margin.right = param.margin_right;
      }
      if(typeof param.margin_bottom != 'undefined') {
        margin.bottom = param.margin_bottom;
      }
    }
    
    console.log(margin);
    
    /*                                               *\
     * Standardization of aesthetics                 *
     * Collecting some informations about dimentions *
    \*                                               */
    
    // Information on each dimention
    var dim = getDimentionsInfo(this.coordSys);
    // Aesthetics
    var aes = [];
    // Map data column name -> aesthetic id
    var dataCol2Aes = {};
    // Map function -> aesthetic id
    var func2Aes = {};
    // Map const value -> aesthetic id
    var const2Aes = {};
    
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i]) {
        // Skip uninteresting attributes and non-set attributes
        if(typeof this.elements[i][attr].type === 'undefined' ||
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
            var aes_ret_type = typeof aes[aesId].func(this.dataset[0], 0);
            if(aes_ret_type != 'number' && aes_ret_type != 'string')
              throw errorMessage(this.elements[i].name, attr+'['+j+']', aes_ret_type, '\'number\' or \'string\'');
            
            this.elements[i][attr].aes[j] = aes[aesId];
            if(typeof dim[j].aes === 'undefined')
              dim[j].aes = [];
              
            dim[j].aes.push(aes[aesId]);
          }
        }
        else {
          // Get the aestetic id
          var aesId = getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val);
          
          // Check data type return by this aesthetic
          var aes_ret_type = typeof aes[aesId].func(this.dataset[0], 0);
          switch(attr_type) {
            case 'color':
              if(aes_ret_type != 'number' && aes_ret_type != 'string') {
                throw errorMessage(this.elements[i].name, attr, aes_ret_type, 'color (\'number\' or \'string\')');
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
    
    // We don't need those variables anymore
    // aes = undefined; TODO: uncomment
    dataCol2Aes = undefined;
    func2Aes = undefined;
    const2Aes = undefined;
    
    
    /*                               *\
     * Computing dimentions' domains *
    \*                               */
    for(var i = 0 ; i < dim.length ; i++) {
      if(typeof dim[i].aes === 'undefined')
        throw 'Error: dimention '+(i+1)+' unused';
      
      var domain;
      var ordinal;
      
      if(dim[i].forceOrdinal)
        ordinal = true;
      else {
        // Don't force ordinal (i.e. continue if only number values)
        var ordinal = false;
        for(var j = 0 ; j < dim[i].aes.length ; j++) {
          if(typeof dim[i].aes[j].func(this.dataset[0]) != 'number') {
            ordinal = true;
            break;
          }
        }
      }
      
      // Ordinal domain
      if(ordinal) {
        domain = [];
        for(var j = 0 ; j < dim[i].aes.length ; j++) {
          // Compute ordinal domain
          var dom;
          if(typeof dim[i].aes[j].ordinalDomain === 'undefined') {
            var f = dim[i].aes[j].func;
            dom = [];
            for(var k = 0 ; k < this.dataset.length ; k++) {
              dom.push(f(this.dataset[k]));
            }
            RemoveDupArray(dom);
            dim[i].aes[j].ordinalDomain = dom;
          }
          else
            dom = dim[i].aes[j].ordinalDomain;
          
          for(var k = 0 ; k < dom.length ; k++)
            domain.push(dom[k]);
        }
        RemoveDupArray(domain);
      }
      // Continue domain
      else {
        domain = [Infinity, -Infinity];
        for(var j = 0 ; j < dim[i].aes.length ; j++) {
          // Compute continuous domain
          var dom;
          if(typeof dim[i].aes[j].continuousDomain === 'undefined') {
            // Compute continuous domain from ordinal one
            if(typeof dim[i].aes[j].ordinalDomain != 'undefined') {
              var ordDom = dim[i].aes[j].ordinalDomain;
              dom = [ordDom[0], ordDom[ordDom.length-1]];
            }
            else {
              var stat = computeStat(this.dataset, dim[i].aes[j].func);
              dom = [stat.min, stat.max];
            }
            dim[i].aes[j].continuousDomain = dom;
          }
          else
            dom = dim[i].aes[j].continuousDomain;
          
          if(dom[0] < domain[0])
            domain[0] = dom[0];
          if(dom[1] > domain[1])
            domain[1] = dom[1];
        }
        
        if(domain[0] == domain[1]) {
          domain = addPadding(domain, linear_scale_padding);
        }
      }
      
      dim[i].domain = domain;
      dim[i].ordinal = ordinal;
    }
    
    /*                  *\
     * Computing scales *
    \*                  */
    
    // For the coordonate system
    this.coordSys.computeScale( dim, 
                                width - margin.left - margin.right,
                                height - margin.top - margin.bottom);
    
    // For other attributes
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i]) {
        // Skip uninteresting attributes and non-set attributes
        if(typeof this.elements[i][attr].type === 'undefined' ||
           this.elements[i][attr].value === null ||
           this.elements[i][attr].type === 'position') {
          continue;
        }
        
        var attr_type = this.elements[i][attr].type;
        var attr_aes = this.elements[i][attr].aes;
        var aes_ret_type = typeof attr_aes.func(this.dataset[0], 0);
        
        switch(attr_type) {
          case 'color':
            if(aes_ret_type === 'string') {
              // No scaling
              this.elements[i][attr].func = attr_aes.func;
            }
            else {
              // Compute continuous domain
              var dom;
              if(typeof attr_aes.continuousDomain === 'undefined') {
                // Compute continuous domain from ordinal one
                if(typeof attr_aes.ordinalDomain != 'undefined') {
                  var ordDom = attr_aes.ordinalDomain;
                  dom = [ordDom[0], ordDom[ordDom.length-1]];
                }
                else {
                  var stat = computeStat(this.dataset, attr_aes.func);
                  dom = [stat.min, stat.max];
                }
                attr_aes.continuousDomain = dom;
              }
              else
                dom = attr_aes.continuousDomain;
              
              // Scaling
              var scale = d3.scale.category10().domain(dom);
              var scale = d3.scale.category10().domain(dom);
              var Closure = function (scale, func) {
              this.s = scale;
              this.f = func;
              var me = this;
                return {
                  action:function (d, i) {
                    return me.s(me.f(d, i));
                  }
                }
              };
              this.elements[i][attr].func = (new Closure(scale, attr_aes.func)).action;
            }
            break;
          
          case 'string':
            // No scaling
            if(aes_ret_type === 'string') {
              this.elements[i][attr].func = attr_aes.func;
            }
            else { // Just apply toString
              var Closure = function (func) {
                this.f = func;
                var me = this;
                return {
                  action:function (d, i) {
                    return me.f(d, i).toString();
                  }
                }
              };
              this.elements[i][attr].func = (new Closure(attr_aes.func)).action;
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
     * Generating svg *
    \*                */
    
    // add Canvas
    var svg = d3.select(selector)
                .append("svg")
                .attr("width", width)
                .attr("height", height);
    
    
    // Add axis
    this.coordSys.drawAxis( svg, dim, margin.left, margin.top,
                            width-margin.left-margin.right,
                            height-margin.top-margin.bottom);
    
    // Draw elements
    for(var i = 0 ; i < this.elements.length ; i++) {
      // Compute 'getX' and 'getY' functions
      var pos;
      if(typeof this.elements[i].position.value === null) {
      
      }
      else {
        pos = new Array(this.elements[i].position.aes.length);
        for(var j = 0 ; j < pos.length ; j++)
          pos[j] = this.elements[i].position.aes[j].func;
      }
      
      // getX
      var Closure = function (coordSys, pos, margin_left) {
        this.cs = coordSys;
        this.p = pos;
        this.ml = margin_left;
        var me = this;
        return {
          action:function (d, i) {
            return me.ml + me.cs.getX(me.p, d, i);
          }
        }
      };
      var getX = (new Closure(this.coordSys, pos, margin.left)).action;
      
      // getY
      Closure = function (coordSys, pos, margin_top) {
        this.cs = coordSys;
        this.p = pos;
        this.mt = margin_top;
        var me = this;
        return {
          action:function (d, i) {
            return me.mt + me.cs.getY(me.p, d, i);
          }
        }
      };
      var getY = (new Closure(this.coordSys, pos, margin.top)).action;
      
      // TODO debug pos 
      // Set attributes for each kind of elements
      // Circle
      if(this.elements[i] instanceof Circle) {
        var node = svg.selectAll('.etl'+i)
                      .data(this.dataset)
                      .enter()
                      .append('circle')
                      .attr('class', 'etl'+i);
        
        svgSetCommonAttributes(node, this.elements[i]);
        
        node.attr('cx', getX);
        node.attr('cy', getY);
        svgSetAttribute(node, 'r' , this.elements[i], 'radius');
        
      }
      // Lines
      else if(this.elements[i] instanceof Line) {
        var lineFunction = d3.svg.line()
                             .x(getX)
                             .y(getY)
                             .interpolate(this.elements[i].interpolation.value);
        
        var node = svg.append('path')
                      .attr('class', 'etl'+i)
                      .attr("d", lineFunction(this.dataset));
           
        svgSetCommonAttributes(node, this.elements[i]);
        
        svgSetAttribute(node, 'stroke-linecap', this.elements[i], 'stroke_linecap');
      }
    }
    
    
  }
  
  
  ////////////////////////
  // Coordonate Systems //
  ////////////////////////
  
  var CoordSys = Class.extend({
    computeScale: function(dim, width, height) {
      throw 'CoordSys.computeScale(dimentions, width, height) is not overridden';
    },
    
    getX: function(pos, d, i) {
      throw 'CoordSys.getX(position, d, i) is not overridden';
    },
    
    getY: function(pos, d, i) {
      throw 'CoordSys.getY(position, d, i) is not overridden';
    },
    
    drawAxis: function(svgNode, dim, offsetX, offsetY, width, height) {
      throw 'CoordSys.drawAxis(svgNode, dim, offsetX, offsetY, width, height) is not overridden';
    }
  });
  
  
  window.Rect = CoordSys.extend({
    initialize : function(param) {
      this.x = null
      this.y = null;
      this.subSys = null;
      this.scaleX = null;
      this.scaleY = null;
      
      if(typeof param === 'undefined') {
        return;
      }
      
      var type = typeof param.x;
      if(type != 'undefined') {
        if(type != 'number') {
          throw errorMessage('Rect', 'x', type, '\'positive integer\'');
        }
        else {
          this.x = param.x-1;
        }
      }
      
      type = typeof param.y;
      if(type != 'undefined') {
        if(type != 'number') {
          throw errorMessage('Rect', 'y', type, '\'positive integer\'');
        }
        else {
          this.y = param.y-1;
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
    },
    
    computeScale: function(dim, width, height) {
      // X scale
      var subWidth = null;
      var subHeight = null;
      
      if(this.x === null) {
        subWidth = width;
      }
      else if(this.subSys != null) {
        this.scaleX = d3.scale.ordinal()
                        .domain(dim[this.x].domain)
                        .rangeRoundBands([0, width], coordSysMargin);
        subWidth = this.scaleX.rangeBand();
      }
      else if(dim[this.x].ordinal) {
        this.scaleX = d3.scale.ordinal()
                        .domain(dim[this.x].domain)
                        .rangePoints([0, width], ordinal_scale_padding);
      }
      else {
        this.scaleX = d3.scale.linear()
                        .domain(addPadding(dim[this.x].domain, linear_scale_padding))
                        .range([0, width])
                        .nice();
      }
      
      // Y scale
      if(this.y === null) {
        subHeight = height;
      }
      else if(this.subSys != null) {
        this.scaleY = d3.scale.ordinal()
                        .domain(dim[this.y].domain)
                        .rangeRoundBands([height, 0], coordSysMargin);
        subHeight = this.scaleY.rangeBand();
      }
      else if(dim[this.y].ordinal) {
        this.scaleY = d3.scale.ordinal()
                        .domain(dim[this.y].domain)
                        .rangePoints([height, 0], ordinal_scale_padding);
      }
      else {
        this.scaleY = d3.scale.linear()
                        .domain(addPadding(dim[this.y].domain, linear_scale_padding))
                        .range([height, 0])
                        .nice();
      }
      
      // Sub coordonate system scale
      if(this.subSys != null) {
        this.subSys.computeScale(dim, subWidth, subHeight);
      }
    },
    
    getX: function(pos, d, i) {
      var X = (this.x != null) ? this.scaleX(pos[this.x](d, i)) : 0;
      
      if(this.subSys != null) {
        X += this.subSys.getX(pos, d, i);
      }
      
      return X;
    },
    
    getY: function(pos, d, i) {
      var Y = (this.y != null) ? this.scaleY(pos[this.y](d, i)) : 0;
      
      if(this.subSys != null) {
        Y += this.subSys.getY(pos, d, i);
      }
      
      return Y;
    },
    
    drawAxis: function(svgNode, dim, offsetX, offsetY, width, height) {
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
      if(this.x != null) {
        var xAxis = d3.svg.axis()
                    .scale(this.scaleX)
                    .orient('bottom');
        
        if(!dim[this.x].ordinal) {
          xAxis.ticks(5);
        }
        
        
        svgNode.append('g')
               .attr('class', 'axis')
               .attr('transform', 'translate('+offsetX+','+(offsetY+height)+')')
               .call(xAxis);
      }
                    
      // Y axis
      if(this.y != null) {
        var yAxis = d3.svg.axis()
                    .scale(this.scaleY)
                    .orient('left');
        
        if(!dim[this.y].ordinal) {
          yAxis.ticks(5);
        }
        
        svgNode.append('g')
               .attr('class', 'axis')
               .attr('transform', 'translate(' +offsetX+ ','+offsetY+')')
               .call(yAxis);
      }
      
      if(this.subSys != null) {
        var rangeX = (this.x != null) ? this.scaleX.range() : [0];
        var rangeY = (this.y != null) ? this.scaleY.range() : [0];
        var subWidth = (this.x != null) ? this.scaleX.rangeBand() : width;
        var subHeight = (this.y != null) ? this.scaleY.rangeBand() : height;
        
        for(var i = 0 ; i < rangeX.length ; i++) {
          for(var j = 0 ; j < rangeY.length ; j++) {
            this.subSys.drawAxis(svgNode, dim, offsetX+rangeX[i], offsetY+rangeY[j], subWidth, subHeight);
          }
        }
      }
    }
  });
  
  
  window.Polar = CoordSys.extend({
    initialize : function(param) {
      this.theta = null;
      this.r = null;
      this.centerX = null;
      this.centerY = null;
      this.scaleT = null;
      this.scaleR = null;
      this.subSys = null;
      
      if(typeof param === 'undefined') {
        return;
      }
      
      var type = typeof param.theta;
      if(type != 'undefined') {
        if(type != 'number') {
          throw errorMessage('Rect', 'theta', type, '\'positive integer\'');
        }
        else {
          this.theta = param.theta-1;
        }
      }
      
      type = typeof param.radius;
      if(type != 'undefined') {
        if(type != 'number') {
          throw errorMessage('Rect', 'radius', type, '\'positive integer\'');
        }
        else {
          this.r = param.radius-1;
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
    },
    
    computeScale: function(dim, width, height) {
      this.centerX = width / 2;
      this.centerY = height / 2;
      
      // Theta
      if(dim[this.theta].ordinal) {
        this.scaleT = d3.scale.ordinal()
                        .domain(dim[this.theta].domain)
                        .rangePoints([0, 2 * Math.PI]);
      }
      else {
        this.scaleT = d3.scale.linear()
                        .domain(dim[this.theta].domain)
                        .range([0, 2*Math.PI]);
      }
      
      // Radius
      var radiusMax = d3.min([width / 2, height / 2]);
      if(dim[this.r].ordinal) {
        this.scaleR = d3.scale.ordinal()
                        .domain(dim[this.r].domain)
                        .rangePoints([0, radiusMax], ordinal_scale_padding);
      }
      else {
        this.scaleR = d3.scale.linear()
                        .domain(dim[this.r].domain)
                        .range([0, radiusMax])
                        .nice();
      }
    },
    
    getX: function(pos, d, i) {
      var theta = (this.theta != null) ? this.scaleT(pos[this.theta](d, i)) : 2*Math.PI;
      var radius = (this.r != null) ? this.scaleR(pos[this.r](d, i)) : this.centerX / 2;
      
      return this.centerX + Math.cos(theta) * radius;
    },
    
    getY: function(pos, d, i) {
      var theta = (this.theta != null) ? this.scaleT(pos[this.theta](d, i)) : 2*Math.PI;
      var radius = (this.r != null) ? this.scaleR(pos[this.r](d, i)) : this.centerX / 2;
      
      return this.centerY - Math.sin(theta) * radius;
    },
    
    drawAxis: function(svgNode, dim, offsetX, offsetY, width, height) {
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
      if(this.r != null) {
        var ticks;
        
        if(dim[this.r].ordinal) {
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
      if(this.theta != null) {
        var ticks;
        
        if(dim[this.theta].ordinal) {
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
          axisNode.append('text')
                  .text(ticks[i].toFixed(2))
                  .attr('text-anchor', 'middle')
                  .attr('x', x)
                  .attr('y', y)
                  .attr('fill', 'black');
        }
      }
    }
  });

  
  ///////////////////////
  // Private functions //
  ///////////////////////
  
  // Add an element to the graphic
  function addElement(g, Type, param) {
    var elt = new Type;
    
    // copying attributes' values from the fallback element
    for(var attr in g.fallback_element) {
      if(typeof g.fallback_element[attr].type != 'undefined') {
        elt[attr] = {type:g.fallback_element[attr].type,
                     value:g.fallback_element[attr].value};
      }
    }
    
    if(typeof param != 'undefined') {
      for(var attr in elt) {
        if(typeof param[attr] != 'undefined' &&
           typeof elt[attr] != 'undefined' && typeof elt[attr].type != 'undefined') {
          if(attr == 'pos')
            elt[attr].value = param[attr].slice();
          else
            elt[attr].value = param[attr];
        }
      }
    }
    g.elements.push(elt);
  }
  
  // Set an svg attribute
  function svgSetAttribute(node, svgAttr, elt, attr) {
    if(elt[attr].value != null) {
      node.attr(svgAttr, elt[attr].func);
    }
  }
  
  // Set common svg attribute
  function svgSetCommonAttributes(node, elt) {
    svgSetAttribute(node, 'stroke-width',     elt, 'stroke_width');
    svgSetAttribute(node, 'stroke',           elt, 'stroke');
    svgSetAttribute(node, 'stroke-dasharray', elt, 'stroke_dasharray');
    svgSetAttribute(node, 'stroke-opacity',   elt, 'stroke_opacity');
    svgSetAttribute(node, 'fill',             elt, 'fill');
    svgSetAttribute(node, 'fill-opacity',     elt, 'fill_opacity');
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
    var min = f(dataset[0], 0);
    var max = min;
    
    for(var i = 1 ; i < dataset.length ; i++){
      var val = f(dataset[i], i);
      
      if(val < min) {
        min = val;
      }
      else if(val > max) {
        max = val;
      }
    }
    
    return {min:min, max:max}
  }
  
  // Generate an error message
  function errorMessage(elt_name, attribute, type, expected) {
    return elt_name+'.'+attribute+' don\'t support value of type \''+type+
           '\'; Expected: '+expected;
  }
  
  // Determinate on which dimention we have to force to ordinal scale
  function getDimentionsInfo(coordSystem) {
    var dim = [];
    var cs = coordSystem;
    
    while(cs != null) {
      // Force ordinal if the coordonate system have a sub coordonate system
      if(cs.subSys != null) {
        if(cs instanceof Rect) {
          if(cs.x != null)
            dim[cs.x] = {forceOrdinal:true};
          
          if(cs.y != null)
            dim[cs.y] = {forceOrdinal:true};
        }
        else { // instanceof Polar
          if(cs.theta != null)
            dim[cs.theta] = {forceOrdinal:true};
          
          if(cs.r != null)
            dim[cs.r] = {forceOrdinal:true};
        }
      }
      else {
        if(cs instanceof Rect) {
          if(cs.x != null)
            dim[cs.x] = {forceOrdinal:false};
          
          if(cs.y != null)
            dim[cs.y] = {forceOrdinal:false};
        }
        else { // instanceof Polar
          if(cs.theta != null)
            dim[cs.theta] = {forceOrdinal:false};
          
          if(cs.r != null)
            dim[cs.r] = {forceOrdinal:false};
        }
      }
      cs = cs.subSys;
    }
    
    return dim;
  }
  
  // get aesthetic id from an attribute
  function getAesId(aes, dataCol2Aes, func2Aes, const2Aes, attr_val) {
    var id;
    
    // If the attribute is bind to an aestetic
    if(typeof attr_val === 'string' && attr_val.indexOf(data_binding_prefix) == 0) {
      var column = attr_val.substring(data_binding_prefix.length);
      
      if(typeof dataCol2Aes[column] === 'undefined')
      {
        // We convert it into a fonction
        var Closure = function (col) {
          this.c = col;
          var me = this;
          return {
            action:function (d) {
              return d[me.c];
            }
          }
        };
        
        aes.push({func:(new Closure(column)).action});
        id = aes.length - 1;
        dataCol2Aes[column] = id;
      }
      else
        id = dataCol2Aes[column];
    }
    // If the value of the attribute is constant
    else if(typeof attr_val === 'number' || typeof attr_val === 'string') {
      if(typeof const2Aes[attr_val] === 'undefined') {
        // We convert it into a fonction
        var Closure = function (v) {
          this.value = v;
          var me = this;
          return {
            action:function () {
              return me.value;
            }
          }
        };
        
        aes.push({func:(new Closure(attr_val)).action,
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
      if(typeof func2Aes[attr_val] === 'undefined')
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
    var renderParams = {};
    renderParams.selector = param && param.selector
    ASSERT(renderParams.selector, "Please specify the selector in plot()")
    LOG("Ready to plot: width={0}, height={1}, margin={2}, selector={3}".format(
          renderParams.width,
          renderParams.height,
          renderParams.margin,
          renderParams.selector))
    ASSERT(this.render, "No function render in this; how am I  supposed to render ??")
    // debugger
    var theGraphic = this;
    window.addEventListener("load", function() { theGraphic.render(param); }, true)
  };
}();

