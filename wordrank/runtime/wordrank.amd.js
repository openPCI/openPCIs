
/*
Build by Wiquid's PCI Generator for TAO platform Free to use
 */

define(['qtiCustomInteractionContext', 'jquery', 'OAT/util/event', 'wordrank/runtime/wordgame'], function(qtiCustomInteractionContext, $, event, WordGame){
    'use strict';

    var wordrank = {
        id : -1,
        getTypeIdentifier : function getTypeIdentifier(){
            return 'wordrank';
        },
        /**
         * Render the PCI :
         * @param {String} id
         * @param {Node} dom
         * @param {Object} config - json
         */
        initialize : function initialize(id, dom, config, assetManager){
            var that = this;
            function startWordRank(dom, config, responseContainer){
              if(that.wordGame){
                that.wordGame.destroy();
              }

              var texts = [];
              var cells = [];
			  var descriptions = [[],[],[],[]];
			  
              try {
                texts = config.texts.trim().split('\n');
				if(config.sample>0) {
					var numTexts=texts.length
// 					console.log(config.numGroups)
					var numGroups=1
					if(config.numGroups>0) numGroups=config.numGroups
					var inGroup=Math.ceil(numTexts/numGroups)
					var sample=[]
					var group=0
//  					console.log(texts)
					for(var i=0;i<config.sample;i++) {
						do {
							var take=Math.min(Math.floor(Math.random()*inGroup+group*inGroup),numTexts-1) //between (including) group*inGroup and (not including) group*inGroup+inGroup, and not higher than numTexts
							var elem=texts[take]
//  							console.log(take)
//  							console.log(elem)
						} while(sample.indexOf(elem)>-1)
						sample.push(elem)
						group++
						if(group>=numGroups) group=0
					}
// 					console.log(sample)
					texts=sample
				}
				if(config.randomorder) texts=shuffle(texts)
                cells = config.cells.split(',');
				if(typeof config.descriptions=="string")
				var desc=config.descriptions.split('\n')
				for(var i=0;i<desc.length;i++) {
					var d=desc[i]
					descriptions[i]=d.split(',')
				}
// 				console.log(descriptions)
              } catch(e){
                console.log(e);
              }
              that.wordGame = new WordGame({
                element: dom,
                cells: cells,
                texts: texts,
                descriptions: descriptions
              });
            }
            //add method on(), off() and trigger() to the current object
            event.addEventMgr(this);

            var _this = this;
            this.id = id;
            this.dom = dom;
            this.config = config || {};
            this.responseContainer = {base : {string : ''}};

            //tell the rendering engine that I am ready
            qtiCustomInteractionContext.notifyReady(this);

            //
//             console.log('initialize', qtiCustomInteractionContext);

            //listening to dynamic configuration change
            this.on('cfgChange', function(key, value){
                _this.config[key] = value;
              startWordRank(dom, _this.config, this.responseContainer);
            });
            startWordRank(dom, config, this.responseContainer);
        },
        /**
         * Programmatically set the response following the json schema described in
         * http://www.imsglobal.org/assessment/pciv1p0cf/imsPCIv1p0cf.html#_Toc353965343
         *
         * @param {Object} interaction
         * @param {Object} response
         */
        setResponse : function setResponse(response){
            var Scontainer = $(this.dom),value;
        },
        /**
         * Get the response in the json format described in
         * http://www.imsglobal.org/assessment/pciv1p0cf/imsPCIv1p0cf.html#_Toc353965343
         *
         * @param {Object} interaction
         * @returns {Object}
         */
        getResponse : function getResponse(){
            return {base : {string : JSON.stringify(this.wordGame.getResult())}};
        },
        /**
         * Remove the current response set in the interaction
         * The state may not be restored at this point.
         *
         * @param {Object} interaction
         */
        resetResponse : function resetResponse(){

            var Scontainer = $(this.dom);

        },
        /**
         * Reverse operation performed by render()
         * After this function is executed, only the inital naked markup remains
         * Event listeners are removed and the state and the response are reset
         *
         * @param {Object} interaction
         */
        destroy : function destroy(){

            var Scontainer = $(this.dom);
            Scontainer.off().empty();
        },
        /**
         * Restore the state of the interaction from the serializedState.
         *
         * @param {Object} interaction
         * @param {Object} serializedState - json format
         */
        setSerializedState : function setSerializedState(state){
          if(state.response){
            this.wordGame.setResult(JSON.parse(state.response.base.string));
          }
        },
        /**
         * Get the current state of the interaction as a string.
         * It enables saving the state for later usage.
         *
         * @param {Object} interaction
         * @returns {Object} json format
         */
        getSerializedState : function getSerializedState(){
            return {};
        }
    };

    qtiCustomInteractionContext.register(wordrank);
});
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}
