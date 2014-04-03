!function() {
"use strict";
  
  var d4 = {
    version: '0.1'
  };
  
  // Some constants
  var data_binding_prefix = 'data:';
  var id_name = "num_row";
  var ordinal_scale_padding = 0.2;
  
  
  // definiting the base constructor for all classes, which will execute the final class prototype's initialize method if exists
  var Class = function() {
    this.initialize && this.initialize.apply(this, arguments);
  };
  Class.extend = function(childPrototype) { // defining a static method 'extend'
    var parent = this;
    var child = function() { // the child constructor is a call to its parent's
      return parent.apply(this, arguments);
    };
    child.extend = parent.extend; // adding the extend method to the child class
    var Surrogate = function() {}; // surrogate "trick
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;
    for(var key in childPrototype){
        child.prototype[key] = childPrototype[key];
    }
    return child; // returning the child class
  };
  
  // TODO : attributes -> {stroke_width:"x", type:number}
  // TODO : x, y -> position (array of dimentions)
  
  var Element = Class.extend({
    initialize : function() {
      this.x = 0;
      this.y = 0;
      this.color = 'white';
      this.stroke_width = 1;
      this.stroke_color = 'black';
     }
  });
    
  var Circle = Element.extend({
    initialize : function() {
      this.radius = 5;
     }
  });
  
  
  window.Graphic = function() {
    this.dataset = null;          
    this.elements = new Array();
    
    this.fallback_element = new Element();
  };
  
  // Set element properties
  Graphic.prototype.element = function(param) {
    if(typeof param != 'undefined') {
      for(var attr in this.fallback_element) {
        if(typeof param[attr] != 'undefined') {
          this.fallback_element[attr] = param[attr];
        }
      }
    }
    //console.log(this.fallback_element);
    return this;
  }
  
  // Add circles
  Graphic.prototype.circle = function(param) {
    var circle = new Circle();
    
    // copying attributes' values from the fallback element
    for(var attr in this.fallback_element) {
      circle[attr] = this.fallback_element[attr];
    }
    
    if(typeof param != 'undefined') {
      for(attr in circle) {
        if(typeof param[attr] != 'undefined') {
          circle[attr] = param[attr];
        }
      }
    }
    
    this.elements.push(circle);
    //console.log(circle);
    return this;
  }
  
  // Set dataset
  Graphic.prototype.data = function(data) {
    this.dataset = data;
    
    return this;
  }
  
  
  // Private : compute some stats (min and max only for now)
  function computeStat(dataset, column, critera) {
    var f;
    
    if(typeof critera === 'function') {
      f = critera;
    }
    else { // critera is a column / variable / aestetic
      f = function (d) {return d[critera];}
    }
    
    var min = f(dataset[0]),
        max = min;
    
    for(var i = 1 ; i < dataset.length ; i++){
      var val = f(dataset[i]);
      
      if(val < min) {
        min = val;
      }
      else if(val > max) {
        max = val;
      }
    }
    
    return {min:min, max:max}
  }
  
  
  // Genere le svg
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
               y:{min:margin.bottom,
                  max:height - margin.top}}


    /*
    console.log(selector);
    console.log(width);
    console.log(heigth);
    console.log(computeStat(this.dataset, "", function(d){return -1*d.col1;}));
    //*/
    
    var svg = d3.select(selector)
                .append("svg")
                .attr("width", width)
                .attr("height", height);
    
    
    // Statitics on each column / variable / aestetic
    var stats = {};
    
    // scale for each dimention (x & y for now)
    var scales = {};
    
    for(var i = 0 ; i < this.elements.length ; i++) {
      for(var attr in this.elements[i]) {
        var attr_val = this.elements[i][attr];
        
        // If the attribute is bind to an aestetic
        if(typeof attr_val === 'string' && attr_val.indexOf(data_binding_prefix) == 0) {
          var column = attr_val.substring(data_binding_prefix.length);
          
          if(attr == 'x' || attr == 'y') {
            // Computing the scale
            if(typeof this.dataset[0][column] == 'number') {
              if(typeof stats[column] === 'undefined') {
                stats[column] = computeStat(this.dataset, column)
              }
                
              scales[attr] = d3.scale.linear()
                               .domain([stats[column].min, stats[column].max])
                               .range([lim[attr].min, lim[attr].max]);
            }
            else { // bind attribute on x or y but not number
              var domain = new Array();
              
              for(var j = 0 ; j < this.dataset ; j++) {
                if(domain.indexOf(this.dataset[j][column]) == -1) {
                  domain.push(this.dataset[j][column]);
                }
              }
              
              scales[attr] = d3.scale.ordinal()
                               .domain(domain)
                               .rangePoints([lim[attr].min, lim[attr].max], ordinal_scale_padding);
            }
            
            this.elements[i][attr] = function (d) {
              return scales[attr](d[column]);
            }
          }
          else { // bind to an aestetic but not a dimentions
            this.elements[i][attr] = function (d) {
              return d[column];
            }
          }
        }
        else if(typeof attr_val === 'function') { // If the value of the attribute is computed by a function
          if(attr == 'x' || attr == 'y') {
            var func = attr_val; // Just to make it clearer
            
            // Computing the scale
            if(typeof func(this.dataset[0]) == 'number') {
              if(typeof stats[func] === 'undefined') {
                stats[func] = computeStat(this.dataset, func)
              }
              
              scales[attr] = d3.scale.linear()
                               .domain([stats[func].min, stats[func].max])
                               .range([lim[attr].min, lim[attr].max]);
            }
            else {
              var domain = new Array();
              
              for(var j = 0 ; j < this.dataset ; j++) {
                var value = func(this.dataset[j]);
                
                if(domain.indexOf(value) == -1) {
                  domain.push(value);
                }
              }
              
              scales[attr] = d3.scale.ordinal()
                               .domain(domain)
                               .rangePoints([lim[attr].min, lim[attr].max], ordinal_scale_padding);
            }
            
            this.elements[i][attr] = function (d) {
              console.log(this.scale);
              return this.scales(func(d));
            }
            this.elements[i][attr].scale = scales[attr];
            
            console.log(this.elements[i][attr]);
          }
          // If the value of the attribute is computed by a function and
          // is not a dimention, nothing to do (no scaling)
        }
        else { // If the value of the attribute is constant
          if(attr == 'x' || attr == 'y') {
            // Computing the scale
            if(typeof attr_val == 'number') {
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
            else {
              scales[attr] = d3.scale.ordinal()
                               .domain([attr_val])
                               .range([lim[attr].min, lim[attr].max]);
            }
          }
          
          this.elements[i][attr] = function (d) {
            return attr_val;
          }
        }
      }
      
      //*
      if(this.elements[i] instanceof Circle) {
        svg.selectAll("circle")
           .data(dataset)
           .enter()
           .append("circle")
           .attr("cx", this.elements[i].x)
           .attr("cy", this.elements[i].y)
           .attr("r", this.elements[i].radius);
      }
      //*/
    }
  }
  
  
}();
