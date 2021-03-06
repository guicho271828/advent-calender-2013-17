////////////////////////////////////////////////////////////////
////
//// code.js -- a replacement for org-info.js
////
//// Written by Masataro Asai (guicho2.71828@gmail.com)
//// Licenced under GPLv3.
////
////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////
// helper functions ////////////////////////////////////////////
////////////////////////////////////////////////////////////////

var identity=function(){};

jQuery.fn.visible = function() {
    return this.css('visibility', 'visible');
};

jQuery.fn.invisible = function() {
    return this.css('visibility', 'hidden');
};

jQuery.fn.emerge = function() {
    return this.addClass("emerging");
};
jQuery.fn.emergeList = function() {
    return this.addClass("emerging-list");
};


function makeitspan(li){
    if(li.childNodes){
        var ns = li.childNodes;
        var len = ns.length;
        for(var i=0;i<len;i++){
            var node = ns[i];
            if (node.nodeType==3){
                var nnode = document.createElement("span");
                li.replaceChild(nnode,node);
                $(nnode).addClass("li-content").text(node.textContent);
            }
        }
    }
}

function expandSibling(e){
    console.log("double clicked!");
    
    $(".li-highlighted").removeClass("li-highlighted");
    $(this).parent().next().emergeList().visible().children(":first-child").addClass("li-highlighted");
    $(this).parent().get(0).removeChild(this);
}

function expandChild(e){
    console.log("clicked!");
    $(".li-highlighted").removeClass("li-highlighted");
    $(this).next().emergeList().visible().children(":first-child").addClass("li-highlighted");
    $(this).parent().get(0).removeChild(this);
}

function setExpanders(){
    $("li").map(
        function(i,li){
            makeitspan(li);
        });
    $("li ~ li").invisible();
    $("li:not(:last-child)").append('<span class="sibling-expander">...</span>');
    $("li > ul").invisible().before('<span class="expander">→</span>');
    $(".expander").click(expandChild);
    $(".sibling-expander").click(expandSibling);
}

function outline(n){
    return ".outline-"+n;
}
function outlineContents(n){
    return ".outline-text-"+n+", h"+n;
}

function container(){
    return Array.prototype.reduce.call(
        arguments,
        function(prev,arg){
            return prev+"-"+arg;
        },
        "#outline-container-sec"
    );
}

function unparseSection(id){
    var re = /outline-container-sec-(.*)/;
    return (id.match(re)||[null,"1"])[1].split("-");
}

function clip(low,x,high,when_low,when_high){
    if (x < low){
        return when_low || low;
    }else if (high || x > high){
        return when_high || high;
    }else {
        return x;
    }
}

function adjustVerticalCenter(){
    var top = 0.4 * ($(window).height() - $(document.body).height());
    var high = 0.2 * $(window).height();
    if (top > high){
        $(document.body)
            .delay( 100 )
            .animate({"margin-top": high});
        slide.headline()
            .delay( 300 )
            .animate({"margin-bottom": top - high});
    }else{
        $(document.body)
            .delay( 100 )
            .animate({"margin-top": clip(20,top)});
    }
}

////////////////////////////////////////////////////////////////
//// Slide objects /////////////////////////////////////////////
////////////////////////////////////////////////////////////////

var nullp = $.isEmptyObject;

function Slide(arg,prev){
    this.previous = prev;
    if (!nullp(arg) && arg.length!=0){
        this.current = arg;
        var matched = arg.get(0).className.match(/outline-([0-9]*)/);
        if(matched){
            this.level=(+matched[1]);
        }else{
            throw new Error("arg is not of class outline-x.");
        }
        return this;
    }else{
        throw new Error("arg is null / jquery object with no match");
    }
}

Slide.prototype = {
    current : undefined, // jquery object
    previous : undefined, // Slide object
    level : 1,
    // hide: function(){
    //   this.current.hide();  
    // },
    headline: function(){
        return $("h1,h2,h3,h4",slide.current).first();
    },
    hideParents: function(){
        for(var i = 1;i<this.level;i++){
            $(outlineContents(i)).hide();
        }
    },
    hideSiblings: function(){
        $(outlineContents(this.level)).hide();
    },
    hideChildren: function(){
        for(var i=this.level+1;0<($(outline(i)).length);i++){
            $(outlineContents(i)).hide();
        }
    },
    showSelf: function(){
        this.current.children(outlineContents(this.level)).show().emerge();
    },
    show: function(){
        this.hideParents();
        this.hideSiblings();
        this.hideChildren();
        this.showSelf();
        adjustVerticalCenter();
        return this;
    },
    nochild : function(){
        return nullp(this.current.children(outline(1+this.level)));
    },
    new : function(next,sustain){
        return new Slide(next,(sustain?this.previous:this));
    },
    up : function(sustain){
        return this.new(this.current.parent(),sustain);
    },
    down : function(sustain){
        return this.new(this.current.children(outline(1+this.level)).first(),sustain);
    },
    left : function(sustain){return this.new(this.current.prev(),sustain)},
    right : function(sustain){return this.new(this.current.next(),sustain)},
    next : function(){
        try{
            return this.down();
        } catch (x) {}
        try{
            return this.right();
        } catch (x) {}
        try{
            return this.up().right(true);
        } catch (x) {}
        throw new Error("next");
    },
    prev : function(){
        if (this.previous){
            return this.previous;
        }else{
            throw new Error("no previous slide");
        }
    },
};

var slide;


////////////////////////////////////////////////////////////////
//// Keyboard event handlers ///////////////////////////////////
////////////////////////////////////////////////////////////////

var keyManager = {};

var keystrokeManager = {
    _stroke: "",
    _minibuffer: $("<div id='minibuffer'></div>"),
    _prompt: $("<span id='prompt'></span>"),
    _input: $("<span id='input'></span>"),
    init: function(def_stroke,def_prompt){
        this.stroke=(def_stroke||"");
        this._prompt.text(def_prompt||"");
        return this;
    },
    push: function(c){
        this.stroke=this.stroke.concat(c);
        return this;
    },
    backspace: function(){
        this.stroke=this.stroke.slice(0,-1);
        return this;
    },
    setup: function(){
        this._minibuffer
            .append(this._prompt)
            .append(this._input);
        $("body").prepend(this._minibuffer);
    },
    query: function(message,fn,def,enteredByDefault){
        var old = this._prompt.text();
        $(window).off("keypress",keyboardHandler);
        this.init(enteredByDefault?def:"",
                  enteredByDefault?message:(message+" (Default:"+def+") "));
        var handler=(function(e){
            try{
                enterHandler(
                    backspaceHandler(
                        cancelHandler(
                            printHandler())))(e);
            } catch (x) {
                if (x=="enter") {
                    var result = this._input.text();
                    keystrokeManager.init("",old);
                    $(window).off("keypress",handler);
                    $(window).on("keypress",keyboardHandler);
                    fn((result=="")?def:result);
                }
                else throw x;
            }
        }).bind(this);
        $(window).on("keypress", handler);
        return true;
    }
};

keystrokeManager.__defineSetter__(
    "stroke",function(str){
        this._stroke = str;
        this._input.text(str);
        return this;
    });
keystrokeManager.__defineGetter__(
    "stroke",function(){
        return this._stroke;
    });


function available_p(e){ return (32 <= e.charCode && e.charCode <= 126)}
function backspace_p(e){ return (e.keyCode == 8)}
function enter_p(e){ return (e.keyCode == 13)}
function cancel_p(e){
    return (e.charCode == 103 && e.ctrlKey) // Ctrl-g
        || (e.keyCode == 27);  // Esc
}


function enterHandler(next){
    return function(e){
        if (enter_p(e)){
            e.stopPropagation();
            e.preventDefault();
            throw "enter";
        } else return (next||identity)(e);        
    };
}

function backspaceHandler(next){
    return function(e){
        if (backspace_p(e)){
            e.stopPropagation();
            e.preventDefault();
            keystrokeManager.backspace();
        } else return (next||identity)(e); 
    };
}

function cancelHandler(next){
    return function(e){
        if (cancel_p(e)){
            e.stopPropagation();
            e.preventDefault();
            console.log("cancelled");
            keystrokeManager.init();
        } else return (next||identity)(e); 
    };
}

function printHandler(next){
    return function(e){
        if (available_p(e)){
            keystrokeManager.push(String.fromCharCode(e.charCode));
        } else return (next||identity)(e);
    };
}

function dispatchHandler(next){
    return function(e){
        if (available_p(e)){
            keystrokeManager.push(String.fromCharCode(e.charCode));
            var handler = keyManager[keystrokeManager.stroke];
            if (typeof handler == "function"){
                try{
                    if (!handler(e)){
                        keystrokeManager.init();
                    }
                } catch (x) {
                    console.error(x);
                    keystrokeManager.init();
                }
            }
        } else return (next||identity)(e);
    };
}

function keyboardHandler(e){
    console.log("charCode:"+e.charCode
                +" keyCode:"+e.keyCode
                +" which:"+e.which
                +" Modifier:"
                +(e.ctrlKey?"Ctrl":"")
                +(e.shiftKey?"Shift":"")
                +(e.metaKey?"Meta":"")
                +(e.altKey?"Alt":""));
    backspaceHandler(
        cancelHandler(
            dispatchHandler()))(e);
    console.log(keystrokeManager.stroke);
}

window.onload = function(){
    $("#content").addClass("outline-1");
    slide = new Slide($("#content"));
    slide.show();
    setExpanders();
    keystrokeManager.setup();
    $(window).keypress(keyboardHandler);
};

keyManager.n = function(){
    $(".title").hide();

    var exps=$(".expander:visible, .sibling-expander:visible",slide.current);
    console.log(slide.level);
    try{
        if(exps.length>0){
            exps.first().click();
        }else{
            slide = slide.next();
        }
        slide.show();
    } catch (x) {
        console.warn("This is the last slide!");
    }

};

keyManager.p = function(){
    console.log(slide.level);
    try{
        slide = slide.prev();
        slide.show();
    } catch (x) {
        console.warn("This is the first slide!");
    }
};

keyManager.s = keyManager.go = function(){
    return sectionPrompt2("Enter a section number");
};

function sectionPrompt2(message){
    return keystrokeManager.query(
        message,function(result){
            result = result.split(".");
            try{
                console.log(container.apply(this,result));
                slide = slide.new($(container.apply(this,result)));
                slide.show();
            } catch (x) {
                sectionPrompt2(container.apply(this,result) + " does not exists.");
            }
        },
        unparseSection(slide.current.get(0).id).join("."));
}

// debug

var debug = false;

function toggleDebug(){
    if (!debug){
        debug = true;
        return (function(){
                    $(this).addClass("debug-border");
                });
    }else{
        debug = false;
        return (function(){
                    $(this).removeClass("debug-border");
                });
    }
}

keyManager.d = function(){
    $(".outline-1,.outline-2,.outline-3,.outline-4,li,ul,ol,h1,h2,h3,h4,.outline-text-2, .outline-text-3, .outline-text-4")
        .map(toggleDebug());
    console.log("debug : "+debug);
};

// unfolding


keyManager.unfold = function(){
    $("*").visible().show();
    $(".note").css({position:"static",top:"1em"});
    $("body").css({overflow:"auto"});
};

keyManager["-"] = function(){
    var maxwidth = parseFloat($("#content").css("max-width"))*0.91;
    var size = parseFloat($("body").css("font-size"))*0.91;
    $("#content").css("max-width",maxwidth);
    $("body").css("font-size",size);
};


keyManager["+"] = function(){
    var maxwidth = parseFloat($("#content").css("max-width"))*1.1;
    var size = parseFloat($("body").css("font-size"))*1.1;
    $("#content").css("max-width",maxwidth);
    $("body").css("font-size",size);
};

