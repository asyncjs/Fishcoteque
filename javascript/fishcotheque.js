(function (jQuery, Broadcast, getScript, window) {
  "use strict";

  var $ = jQuery.noConflict(true),
      Events = Broadcast.noConflict(),
      $fishcotheque = $('#fishcotheque'),
      fishcothequeEl = $fishcotheque[0],
      creatures = {}, fishcotheque = {},

      // File that contains a list of urls, passed to fishcotheque.load
      //CREATURE_URL_LIST = 'http://jsbin.com/uxukok/latest',
      CREATURE_URL_LIST = false,

      // The number of frames/second that the "tick" event will fire.
      FRAMERATE = 25,

      // If a frame is rendered more than this number of milliseconds after the previous one, then ditch the frame
      FRAME_CUTOFF = 100;

  /////

  // Create the global fishcotheque object.
  window.fishcotheque = fishcotheque = $.extend({}, Events, {
    // jQuery object
    jQuery: $,

    _size: {
        width: $fishcotheque.width(),
        height: $fishcotheque.height()
    },

    // Gets a particular creature by the name or null if not found.
    //
    //   var prem = fishcotheque.get('prem');
    //   if (prem) {
    //     prem.trigger('hello');
    //   }
    //
    get: function (name) {
      return creatures[name] || null;
    },

    // Gets a read-only object with copies of all creatures.
    //
    //   $.each(fishcotheque.all(), function (creature, name) {
    //     console.log("hello " + name);
    //   });
    //
    all: function () {
      return creatures;
    },

    // Loads args.
    loadScript: getScript,

    // Load CSS
    loadCSS: function (file) {
      $('head').append('<link rel="stylesheet" href="' + file + '" />');
    },

    // Creates a new Creature in the environment. This is the main method that
    // will be used to populate the environment.
    //
    //   fishcotheque.createCreature('bill', function (creature) {
    //     creature.el.size({width: 300, height: 120});
    //     creature.el.position({top: 20, left: 0});
    //   });
    //
    createCreature: function (name, callback) {
      var element, creature;

      if (creatures[name]) {
        window.console.warn('The creature "%s" already exists!', name);
        return;
      }

      element  = $('<div class="creature creature--' + name + '" data-id="' + name + '" />').appendTo($fishcotheque);
      creature = new Creature(name, element);

      // detect the type
      creature.environment = document.currentScript.src.indexOf('environment') !== -1;


      try {
        callback.call(creature, creature);
        creatures[name] = creature;

      }
      catch (error) {
        fishcotheque.trigger('crash', name, error);
      }

      return this;
    },

    // Returns the size (width/height) of the environment.
    size: function () {
      return this._size;
    },

    recalculateSize: function(){
        this._size = {
            width: $fishcotheque.width(),
            height: $fishcotheque.height()
        };
        return this;
    },

    // Returns the position (top/left/zIndex) of the center of the
    // environment.
    //
    //   var center = fishcotheque.center();
    //   creature.position({width: center.left, height: center.top});
    //
    center: function () {
      var size = fishcotheque.size();

      return {
        top:  size.height / 2,
        left: size.width / 2
      };
    },

    isRunning: false,

    _tickRef: null,

    // Derived from https://gist.github.com/1114293#file_anim_loop_x.js
    // See http://hacks.mozilla.org/2011/08/animating-with-javascript-from-setinterval-to-requestanimationframe/
    _tick: (function(){
        // feature testing
        var raf = window.requestAnimationFrame       ||
                  window.mozRequestAnimationFrame    ||
                  window.webkitRequestAnimationFrame ||
                  window.msRequestAnimationFrame     ||
                  window.oRequestAnimationFrame;

        function animLoop(){
            var lastFrame = +new Date;

            function loop(now) {
                var deltaT;

                if (fishcotheque.isRunning){
                  raf ?
                    raf(loop, fishcothequeEl) :
                    // fallback to setTimeout
                    fishcotheque._tickRef = window.setTimeout(loop, 1000 / FRAMERATE);

                  // Make sure to use a valid time, since:
                  // - Chrome 10 doesn't return it at all
                  // - setTimeout returns the actual timeout
                  now = now && now > 1E4 ? Math.round(now) : +new Date;
                  deltaT = now - lastFrame;

                  lastFrame = now;

                  // do not render frame when deltaT is too high
                  if (deltaT < FRAME_CUTOFF && deltaT > 0) {
                    fishcotheque.trigger("tick", deltaT, now);
                  }
                }
            }

            loop();
        }

        return animLoop;
        }()),

        // Usage
        /* animLoop(function( deltaT, now ) {
            // rendering code goes here
            // return false; will stop the loop
        ...
        // optional 2nd arg: elem containing the animation
        }, animWrapper );
        */

    start: function(){
      this.isRunning = true;

      return this
        .trigger("start")
        ._tick();
    },

    stop: function(){
      this.isRunning = false;
      window.clearTimeout(this._tickRef);
      this._tickRef = null;
      return this.trigger("stop");
    },

    init: function(){
      var events = {
        crash : function (name, error) {
          window.console.log(
            name + " failed at evolution",
            error.name + ': ' + error.message,
            error.stack ? (error.length ? Array.prototype.join(error.stack,'\n') : error.stack) : "no stack"
          );
        }
      };

      // Bind default events.
      $.each(events, function (n, cb) {
        fishcotheque.bind(n, cb);
      });

      // Load the list of creatures
      if (CREATURE_URL_LIST){
        this.load(CREATURE_URL_LIST);
      }

      // Set a ticker going
      return this.start();
    },

    hasSearchParam: function(param, value){
        var pattern = "^[\?&]" + param +
            (typeof value === "undefined" ? "($|[=&])" : "=" + value + "($|&)");
        return (new RegExp(pattern)).test(window.location.search);
    }
  });


  /////


  // Create a Creature object.
  function Creature(name, element) {
    Events.call(this, {alias: false});
    this.el = element;
    this._name = name;
    this._data = {};
    this._size = {
        width:0,
        height:0
    };
    this._position = {
        top: 0,
        left: 0,
        zIndex: 0
    };
  }

  Creature.prototype = new Events({alias: false});
  $.extend(Creature.prototype, {
    // Reassign the constructor.
    constructor: Creature,

    // Returns the creature name.
    name: function () {
      return this._name;
    },

    // Allows get/setting of metadata in an object.
    //
    //   // Set yr data here.
    //   creature.data({foodstuffs: ['Apples', 'Oranges', 'Pears']});
    //
    //   // Get yr data there.
    //   creature.data().foodstuffs; //=> {foodstuffs: ['Apples', 'Oranges', 'Pears']}
    //
    data: function (data) {
      if (!data) {
        return this._data;
      }

      $.extend(this._data, data);
      return this;
    },

    // Allows get/setting of creature element width/height. Accepts the same
    // values as jQuery.width()/jQuery.height().
    //
    //   // Set yr sizes here.
    //   creature.size({width: 20, height: 40});
    //
    //   // Get yr size there.
    //   creature.size(); //=> {width: 20, height: 40}
    //
    size: function (size) {
      var typeWidth, typeHeight;

      if (!size) {
        return this._size;
      }

      // Set new size
      this.el.css(size);

      // WIDTH
      typeWidth = typeof size.width;
      if (typeWidth === "number"){
        this._size.width = size.width;
      }
      // Recalculate dimensions, if relative CSS units used
      else if (typeWidth === "string"){
        this._size.width = this.el.width();
      }

      // HEIGHT
      typeHeight = typeof size.height;
      if (typeHeight === "number"){
        this._size.height = size.height;
      }
      // Recalculate dimensions, if relative CSS units used
      else if (typeHeight === "string"){
        this._size.height = this.el.height();
      }

      return this;
    },

    // Allows get/setting of creature element top/left/zIndex. Accepts the same
    // values as jQuery.css() would expect. If possible, use only numbers, not strings.
    //
    //   // Set yr sizes here.
    //   creature.position({top: 20, left: 40});
    //
    //   // Get yr size there.
    //   creature.position(); //=> {top: 20, left: 40, zIndex: 0}
    //
    position: function (position) {
      var typeTop, typeLeft, offset;

      if (!position) {
        return this._position;
      }

      // Set new position
      this.el.css(position);

      // TOP
      typeTop = typeof position.top;
      if (typeTop === "number"){
        this._position.top = position.top;
      }
      // Recalculate dimensions, if relative CSS units used
      else if (typeTop === "string"){
        offset = this.el.offset();
        this._position.top = offset.top;
      }

      // LEFT
      typeLeft = typeof position.left;
      if (typeLeft === "number"){
        this._position.left = position.left;
      }
      // Recalculate dimensions, if relative CSS units used
      else if (typeLeft === "string"){
        this._position.top = offset ? offset.left : this.el.offset().left;
      }

      // Z-INDEX
      if (typeof position.zIndex === "number"){
        this._position.zIndex = position.zIndex;
      }

      return this;
    },

    // Centers the creature in the world.
    center: function () {
      var worldCenter = fishcotheque.center();
      this.position({
        left: worldCenter.left - (this.width()  / 2),
        top:  worldCenter.top  - (this.height() / 2)
      });
      return this;
    },

    // Returns a readonly version of the creature. None of the setters will
    // have any effect.
    readonly: function () {
      var creature = this, readable = {},
          methods = {name: 1, data: 1, position: 1, size: 1},
          method;

      for (method in creature) {
        if (creature.hasOwnPropery(method) && !methods[method]) {
          if (typeof readable[method] === 'function') {
            readable[method] = $.proxy(creature[method], creature);
          } else {
            readable[method] = creature[method];
          }
        }
      }

      // Redefine the readonly methods.
      $.each(methods, function (method) {
        readable[method] = function () {
          return creature[method]();
        };
      });

      return readable;
    }
  });

  /////

  fishcotheque.init();

}(this.jQuery, this.Broadcast, this.getScript, this));
