!function() {
"use strict";
  
  var d4 = {
    version: '0.1'
  };
  
  // Some constants
  var data_binding_prefix = 'data:';
  var id_name = "num_row";
  var ordinal_scale_padding = 0.2;
  var linear_scale_padding = 0.1
  
  
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
  
  // TODO : x, y -> position (array of dimentions)m,
  
  // Elements definition
  // Remark: dimention can be both numerical value or string (discrete value)
  var Element = Class.extend({
    initialize : function() {
      this.name = 'Element';
      this.x = {type:'dimention',
                value:0};
      this.y = {type:'dimention',
                value:0};
      this.fill = {type:'color',
                    value:'white'};
      this.stroke_width = {type:'number',
                           value:1};
      this.stroke = {type:'color',
                           value:'black'};
     }
  });
    
  var Circle = Element.extend({
    initialize : function() {
      this.name = 'Circle';
      this.radius = {type:'number',
                     value:5};
     }
  });
  
  
  // Graphic definition
  window.Graphic = function() {
    this.dataset = null;          
    this.elements = new Array();
    
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
    var circle = new Circle();
    
    // copying attributes' values from the fallback element
    for(var attr in this.fallback_element) {
      if(typeof this.fallback_element[attr].type != 'undefined') {
        circle[attr] = this.fallback_element[attr];
      }
    }
    
    if(typeof param != 'undefined') {
      for(var attr in circle) {
        if(typeof param[attr] != 'undefined' &&
           typeof circle[attr] != 'undefined' && typeof circle[attr].type != 'undefined') {
          circle[attr].value = param[attr];
        }
      }
    }
    
    this.elements.push(circle);
    
    return this;
  }
  
  // Set dataset
  Graphic.prototype.data = function(data) {
    this.dataset = data;
    
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
    
    // values limits
    var lim = {x:{min:margin.left,
                  max:width - margin.right},
               y:{min:height - margin.bottom,
                  max:margin.top}}
    
    
    var svg = d3.select(selector)
                .append("svg")
                .attr("width", width)
                .attr("height", height);
    
    
    // Statitics on each column / variable / aestetic
    var stats = {};
    
    // Scale for each dimention (x & y for now)
    var scales = {};
    
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i]) {
        // Uninteresting attributes (initialise, name, ...)
        if(typeof this.elements[i][attr].type === 'undefined') {
          continue;
        }
        
        var attr_type = this.elements[i][attr].type;
        var attr_val = this.elements[i][attr].value;
        
        // If the attribute is bind to an aestetic
        if(typeof attr_val === 'string' && attr_val.indexOf(data_binding_prefix) == 0) {
          var column = attr_val.substring(data_binding_prefix.length);
          
          // We convert it into a fonction
          this.elements[i][attr].value = function (d, i) {return d[column]}
        }
        // If the value of the attribute is constant
        else if(typeof attr_val === 'number' || typeof attr_val === 'string') {
          // Computing the scale
          if(attr_type === 'dimention' && typeof scales[attr] === 'undefined') {
            if(typeof attr_val === 'number') {
              var domain;
              
              if(attr_val != 0) {
                domain = [0, attr_val * 2];
              }
              else {
                domain = [-1, 1];
              }
              
              scales[attr] = d3.scale.linear()
                               .domain(domain)
                               .range([lim[attr].min, lim[attr].max]);
                               
            }
            else { // typeof attr_val === 'string'
              scales[attr] = d3.scale.ordinal()
                               .domain([attr_val])
                               .rangePoints([lim[attr].min, lim[attr].max], ordinal_scale_padding);
            }
          }
          
          var Closure = function (v) {
            this.value = v;
            var me = this;
            return {
              action:function (d, i) {
                return me.value;
              }
            }
          };
          this.elements[i][attr].value = (new Closure(attr_val)).action;
        }
        else if(typeof attr_val != 'function') {
          throw errorMessage(this.elements[i].name, attr, (typeof attr_val), attr_type);
        }
        
        
        // If the value of the attribute is computed by a function
        var func = this.elements[i][attr].value; // Just to make it clearer
        var func_ret_type = typeof func(this.dataset[0], 0);
        
        switch(attr_type) {
          case 'dimention':
            // Computing the scale
            if(typeof scales[attr] === 'undefined') {
              if(func_ret_type === 'number') {
                if(typeof stats[func] === 'undefined') {
                  stats[func] = computeStat(this.dataset, func)
                }
                
                scales[attr] = d3.scale.linear()
                                 .domain(addPadding([stats[func].min, stats[func].max], linear_scale_padding))
                                 .range([lim[attr].min, lim[attr].max])
                                 .nice();
                
              }
              else if(func_ret_type === 'string') {
                var domain = new Array();
                
                for(var row in this.dataset) {
                  var value = func(row);
                  
                  if(domain.indexOf(value) == -1) {
                    domain.push(value);
                  }
                }
                
                scales[attr] = d3.scale.ordinal()
                                 .domain(domain)
                                 .rangePoints([lim[attr].min, lim[attr].max], ordinal_scale_padding);
              }
              else {
                throw errorMessage(this.elements[i].name, attr, (typeof attr_val), '\'number\' or \'string\'');
              }
            }
            
            var Closure = function (s, f) {
              this.scale = s;
              this.func = f;
              var me = this;
              return {
                action:function (d, i) {
                  return me.scale(me.func(d, i));
                }
              }
            };
            this.elements[i][attr].value = (new Closure(scales[attr], func)).action;
            break;
          
          case 'color':
            if(func_ret_type === 'number') {
              if(typeof stats[func] === 'undefined') {
                stats[func] = computeStat(this.dataset, func)
              }
              
              var scale = d3.scale.category10()
                        .domain([stats[func].min, stats[func].max]);
                                               
              var Closure = function (s, f) {
                this.scale = s;
                this.func = f;
                var me = this;
                return {
                  action:function (d, i) {
                    return me.scale(me.func(d, i));
                  }
                }
              };
              this.elements[i][attr].value = (new Closure(scale, func)).action;
            }
            else if(func_ret_type != 'string') {
              throw errorMessage(this.elements[i].name, attr, (typeof attr_val), 'color (\'number\' or \'string\')');
            }
            break;
          case 'number':
            if(func_ret_type != 'number') {
              throw errorMessage(this.elements[i].name, attr, (typeof attr_val), '\'number\'');
            }
            break;
        }
      }
      
      
      if(this.elements[i] instanceof Circle) {
        svg.selectAll("circle")
           .data(this.dataset)
           .enter()
           .append("circle")
           .attr("cx", this.elements[i].x.value)
           .attr("cy", this.elements[i].y.value)
           .attr("r", this.elements[i].radius.value)
           .attr("stroke-width", this.elements[i].stroke_width.value)
           .attr("stroke", this.elements[i].stroke.value)
           .attr("fill", this.elements[i].fill.value);
      }
    }
    
    
    // X axis
    var xAxis = d3.svg.axis()
                  .scale(scales.x)
                  .orient("bottom")
                  .ticks(5);
    
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + (height - margin.bottom) + ")")
      .call(xAxis);
      
    // Y axis
    var yAxis = d3.svg.axis()
                  .scale(scales.y)
                  .orient("left")
                  .ticks(5);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + margin.left + ",0)")
        .call(yAxis);

  }
  
  
  ///////////////////////
  // Private functions //
  ///////////////////////

  function addPadding(interval, padding) {
    if(interval[0] != interval[1]) {
      return [interval[0] - (interval[1] - interval[0]) * padding,
              interval[1] + (interval[1] - interval[0]) * padding];
    }
    else if(interval[0] != 0) {
      return [0, interval[0] * 2];
    }
  }
  
  
  // Private : compute some stats (min and max only for now)
  function computeStat(dataset, critera) {
    var f;
    
    if(typeof critera === 'function') {
      f = critera;
    }
    else { // critera is a column / variable / aestetic
      f = function (d) {return d[critera];}
    }
    
    
    
    var min = f(dataset[0], 0),
        max = min;
    
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
  
  
  function errorMessage(elt_name, attribute, type, expected) {
    return elt_name+'.'+attribute+' don\'t support value of type \''+type+
           '\'; Expected: '+expected;
  }
  
}();
