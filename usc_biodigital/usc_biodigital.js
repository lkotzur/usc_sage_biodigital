//
// SAGE2 application: usc_biodigital
// by: Mark Utting <utting@usc.edu.au>
//
// Copyright (c) 2016
//

"use strict";

/* global HumanAPI */
var IFRAME_ID = 'embedded-human';
var PAN_STEP = 1.0;
// For Quiz
// a list of scene objects
var sceneObjects = {};


var usc_biodigital = SAGE2_App.extend({
	init: function(data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		this.data = data;
		
		this.tool = "default"; // default tool
		
		// load the BioDigital HumanAPI
		var s = document.createElement('script');
		s.type = 'text/javascript';
		s.src = 'https://developer.biodigital.com/builds/api/2/human-api.min.js';
		var l = document.createElement("link");
		l.type = "text/css";
		l.href = this.resrcPath + "css.css";
		l.rel = "stylesheet";
		document.head.appendChild(l);
		document.body.appendChild(s);

		// Set the DOM id
		this.element.id = "div_" + "usc_biodigital";
		console.log('usc_biodigital> id=', this.id, 'init element=', this.element,
		    'w=', this.element.clientWidth, 'h=', this.element.clientHeight);
		
		// generate the widget interface of the usc_biodigital
		this.addWidgetButtons();

		// Set the background to black
		this.element.style.backgroundColor = '#87CEEB';			
		
		/*var iframe = document.createElement('iframe');
		iframe.src = this.state.value;
		iframe.id = IFRAME_ID + this.id;
		iframe.width =  '100%';
		iframe.height =  '100%';
		iframe.setAttribute("style", "float:left");*/
		var iframe_id = IFRAME_ID + this.id;
		//this.element.appendChild(iframe);
		var source = `${this.state.value}&dk=${this.state.dk}`;
		console.log("developer key", source);
		this.element.innerHTML = `<iframe id="${iframe_id}" src="${source}" width="100%" height="100%">
			</iframe>
			<script src="https://developer.biodigital.com/builds/api/2/human-api.min.js"></script>
			<div id="panel">
			<h2>Select the <b><span id="selectedObjectElement"></span> bone</b></h2>
			<!-- display only after response -->
			<div id="response-panel">
				<div id="response-selection">
				<h2>Your Selection: <span id="userSelectedObject"></span></h2>
				</div>
				<span id="response-label"></span>
				<button id="nextBtn">Next</button>
			</div>
			<form id="questions-form">
				<button id="submitBtn">Submit</button>
			</form>

			</div>`;
		this.humanIframe = document.getElementById(iframe_id);
		console.log(this.humanIframe);
						
		this.humanQuiz = null;
		this.isQuiz = false;
		this.window = 0.0;
		this.interval = 0;
		this.h = 0;
		this.m = 0;
		this.s = 0;
		this.missed = -1;
		this.numQuestions = 0;
		this.correctAnswers = 0;
		this.lenName = 0;

		// initialise our own object state.
		this.currentZoom = 0.3;

		// move and resize callbacks
		this.resizeEvents = "continuous"; // onfinish
		// this.moveEvents   = "continuous";

		// SAGE2 Application Settings
		//
		// Control the frame rate for an animation application
		this.maxFPS = 2.0;
	},
		
	addWidgetButtons: function() {

		// adding widget buttons
		this.controls.addButton({type: "reset", position: 10, identifier: "Reset", label: "Reset"});
		this.controls.addButton({type: "quiz", position: 4, identifier: "Quiz", Label: "Quiz"});
		this.controls.addButton({type: "play", position: 1, identifier: "PlayButton", label: "Play"});
		this.controls.addButton({type: "play-pause", position: 2, identifier: "play-pause"});
		this.controls.addButton({type: "next", position: 6, identifier: "Next"});
		this.controls.addButton({type: "prev", position: 7, identifier: "Prev"});

		// adding radio options
		this.viewTypeRadioButton = this.controls.addRadioButton({identifier: "ViewType",
			label: "View",
			options: ["Norm", "X-ray", "Iso"],
			default: "Norm"
		});

		//Would like to add pan in future
		this.pointerTypeRadioButton = this.controls.addRadioButton({identifier: "PointerType",
			label: "Pointer",
			options: ["Sel", "Dis", "Rota"],
			default: "Rota"
		});

		this.modelTypeRadioButton = this.controls.addRadioButton({identifier: "ModelType",
			label: "Model",
			options: ["Heart", "Male"],
			default: "Heart"
		});

		this.controls.finishedAddingControls();
		console.log(this.controls.addButtonType);
		this.enableControls = true;
	},
		
	startClock: function () {
		var self = this;
		var totalSeconds = 0;
		
		this.interval = setInterval(function () {
		totalSeconds += 1;

		document.getElementById("hour" + self.id).textContent = ("Time: " + Math.floor(totalSeconds / 3600) + " : ");
		document.getElementById("min" + self.id).textContent = Math.floor(totalSeconds / 60 % 60) + " : ";
		document.getElementById("sec" + self.id).textContent = parseInt(totalSeconds % 60);
		}, 1000);
	},

	pauseClock: function () {
		console.log(this.interval);
	    clearInterval(this.interval);
	    delete this.interval;
	},
  	  			  	  
	btnQuizClick: function(){
		var _this = this;
		// changes iframe to the example quiz code widget
		// todo load src from quiz.json model + dk
		// declare objects to select
		this["QUIZ_OBJECTS"] = [{name: "Maxilla"}, {name: "Right temporal"}, {name: "Occipital"}, {name: "Mandible"}, {name: "Left Zygomatic"}];
		console.log(this.QUIZ_OBJECTS);
		// a list of object selections
		this["selectedIndex"] = 0;
		
		// DOM elements
		var panel = document.getElementById("panel");
		var submitBtn = document.getElementById("submitBtn");
		var nextBtn = document.getElementById("nextBtn");
		var findSubmit = submitBtn.getBoundingClientRect();
		panel.style.display = 'block';
		
		// get a random object in the list
		function getRandomObject(objects) {
			var object = objects[Math.floor(Math.random() * objects.length)];
			return object;
		}

		// track human selection vs user selection
		this["selectedObject"] = null;
		this["userSelectedObject"] = null;

		// disable labels + tooltips + annotations
		this.human.send("labels.setEnabled", {enable: false});
		this.human.send("tooltips.setEnabled", {enable: false});
		this.human.send("annotations.setShown", {enable: false});
		
		this.human.on("scene.picked", function(event) {
			console.log("'scene.picked' event: " + JSON.stringify(event));
			var pickedObjectId = event.objectId;
			var pickedObject = sceneObjects[pickedObjectId];
			_this.setUserSelection(pickedObject);  
		});

		this.human.on("human.ready", function() {
			// get a list of objects
			this.send("scene.info", function(data) {
				// get global objects
				sceneObjects = data.objects;
				for (var objectId in sceneObjects) {
					var object = sceneObjects[objectId];
					// for each of our quiz objects, find matching scene object
					for (var i = 0; i < _this.QUIZ_OBJECTS.length; i++) {
						var quizObject = _this.QUIZ_OBJECTS[i];
						var objectFound = _this.matchNames(object.name, quizObject.name);
						if (objectFound) {
							quizObject.objectId = objectId;
						}
					}
				}
				// start quiz
				_this.nextSelection();
			});
		});

		// listen to object pick event
		_this.human.on("scene.picked", function(event) {
			console.log("'scene.picked' event: " + JSON.stringify(event));
			var pickedObjectId = event.objectId;
			var pickedObject = sceneObjects[pickedObjectId];
			_this.setUserSelection(pickedObject);  
		});

		submitBtn.addEventListener("click", function(e) {
			if (!_this.userSelectedObject) {
				alert("Please select an object.")
			} else {
				// check if quiz selection matches user selection
				var isCorrect = this.matchNames(_this.selectedObject.objectId, _this.userSelectedObject.objectId);
				_this.setResponse(isCorrect, true, submitBtn);
			}
			// prevent submit
			e.preventDefault();
		});

		nextBtn.addEventListener('click', function(e) {
			// reset selections
			_this.human.send('scene.selectObjects', { replace: true });
			// reset camera and proceed to next
			_this.human.send('camera.reset', function() {
				_this.nextSelection();
			});
			// prevent submit
			e.preventDefault();
		});
		
		// current quiz code starts here
		/*/ read info for the quiz from quiz.json
		var _this = this;
		
		if (!_this.isQuiz) {
			_this.isQuiz = true;
			
			var divQuiz = document.createElement('div');
			divQuiz.id = "quizPanel" + this.id;
			divQuiz.height = _this.humanIframe.height;
			divQuiz.setAttribute("style", "float:right");	
							
			this.h = document.createElement('span');
			this.h.id = "hour" + this.id;
			this.h.style.color = "red";
			divQuiz.appendChild(this.h);
							
			this.m = document.createElement('span');
			this.m.id = "min" + this.id;
			this.m.style.color = "red";
			divQuiz.appendChild(this.m);
			
			this.s = document.createElement('span');
			this.s.id = "sec" + this.id;
			this.s.style.color = "red";
			divQuiz.appendChild(this.s);	
			
			this.miss = document.createElement('p');
			this.miss.id = "missed" + this.id;
			this.miss.style.color = "red";
			divQuiz.appendChild(this.miss);	
							 	  
			var quizPath = this.resrcPath + "quiz.json";
		//	console.log(quizPath);
			var appId = this.id;

			
			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function() {
				if ( xhr.readyState === 4 ) {
					if ( xhr.status === 200 || xhr.status === 0 ) {
						var jsonObject = JSON.parse( xhr.responseText );
						var list = document.createElement('ul');
						var obj = JSON.parse(xhr.responseText);
						_this.window = obj.window;
						_this.numQuestions = obj.number;
						
						for (var i = 0; i < obj.questions.length; i++){
							
								var liName = obj.questions[i].id + appId;
								var li = document.createElement('p');
								li.setAttribute('id', liName);
								
								li.appendChild(document.createTextNode(obj.questions[i].name + "\n"));
								list.appendChild(li);
								divQuiz.appendChild(list);
								divQuiz.style.fontSize = (_this.element.clientWidth / 30 + "px");
						}
						//var test = _this.element.clientWidth - _this.window * _this.element.clientWidth;
						divQuiz.width = _this.window * _this.element.clientWidth;
						_this.humanIframe.width = _this.element.clientWidth - divQuiz.width;
					}
				}
			};

			xhr.open("GET", quizPath, false);
			xhr.setRequestHeader("Content-Type", "text/plain");
			xhr.send(null);
			
			
			//	d3.select("#" + liName).attr("fill", "blue");;
			//
			this.humanQuiz = divQuiz;
			this.element.appendChild(this.humanQuiz);
			this.startClock();
			
		}	*/
	},

	// For Quiz
	// selects the next object in the list
	nextSelection : function(){
		// DOM Element
		var selectedObjectDOM = document.getElementById("selectedObjectElement");
		// clear selected object and text
		this.setUserSelection(null);
		this.setResponse(false, false);
		
		// get the next object (within range)
		this.selectedIndex++;
		var randomObjectIndex = this.selectedIndex % this.QUIZ_OBJECTS.length;
		this.selectedObject = this.QUIZ_OBJECTS[randomObjectIndex];
		selectedObjectDOM.innerHTML = this.selectedObject.name;
	},

	// For Quiz
	setUserSelection: function(object){
		// DOM Element
		var userSelected = document.getElementById("userSelectedObject");

		this.userSelectedObject = object;
		userSelected.innerHTML = object ? object.name : "";
	},

	// For Quiz
	setResponse: function(isCorrect, doShow, submitBtn){
		// DOM Elements
		var submitBtn = document.getElementById("submitBtn");
		var responsePanel = document.getElementById("response-panel");
		var responseLabel = document.getElementById("response-label");
		var responseSelection = document.getElementById("response-selection");

		// set label
		responseLabel.innerHTML = isCorrect ? 'Correct!' : 'Incorrect!';
		
		if(!isCorrect) {
			responseLabel.style.color = "red";
			responseSelection.style.display = 'block';
		}
		else {
			responseLabel.style.color = "green";
			responseSelection.style.display = 'none';
		}
		
		// set next navigation
		responsePanel.style.display = doShow ? 'block' : 'none';
		submitBtn.style.display = doShow ? 'none' : 'block';
	},

	// For Quiz
	// returns if a names match or contains substring
	matchNames: function(a, b){
		return a === b || a.trim().toLowerCase().indexOf(b.trim().toLowerCase()) > -1;
	},

	/*Not currently used
	btnAnnotateClick: function(){
		this.parent.tool = "annotate"; // select
		console.log('usc_biodigital> Annotate Button');
		this.parent.human.send("input.enable");
		this.parent.changeTool();
	},*/
		
	changeTool: function(){
		this.human.send("scene.pickingMode", this.tool);
	    
	    this.human.on("scene.pickingModeUpdated", function(event) {
			console.log("Enabling " + event.pickingMode + " mode. Click to " + event.pickingMode + " an object");
		});
	},
		
	load: function(date) {
		console.log('usc_biodigital> Load with state value', this.state.value);
		this.refresh(date);
	},

	draw: function(date) {
	},

	resize: function(date) {
		// Called when window is resized
		var w = this.element.clientWidth;
		var h = this.element.clientHeight;
		
		console.log(this.window + " " + this.isQuiz);
		if (this.isQuiz) {
			this.humanIframe.width = (1-this.window) * w;
			this.btnQuizClick();
		}
		else
			this.humanIframe.width = w;
			//this.btnQuizClick();
		
		this.humanIframe.setAttribute("style", "width:" + w + "px");
		this.humanIframe.setAttribute("style", "height:" + h + "px");
		if (this.isQuiz) {
			this.humanQuiz.style.fontSize = (this.element.clientWidth / 30 + "px");
		}
		this.refresh(date);
	},

	move: function(date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	},

	quit: function() {
		// Make sure to delete stuff (timers, ...)
	},

	// function used to invoke button actions
	inButton: function(x, y, buttonId) {
		var btn = document.getElementById(buttonId);
		var findBtn = btn.getBoundingClientRect();
		console.log("Submit button", btn, findBtn);
		return (findBtn.top <= y && y <= findBtn.bottom && findBtn.left <= x && x <= findBtn.right);
	},

	reset: function() {
		this.human.send("scene.reset");
		this.changeTool();
		this.pointerTypeRadioButton.value = "Sel";
		this.viewTypeRadioButton.value = "Norm";
		this.isQuiz = false;
		this.humanIframe.width = this.element.clientWidth;
		this.element.removeChild(this.humanQuiz);
		this.humanQuiz = null;
		this.pauseClock();
	},
	
	event: function(eventType, position, user_id, data, date) {
		//console.log('usc_biodigital> eventType, pos, user_id, data, dragging',
		//		eventType, position, user_id, data, this.dragging);
		//console.log(eventType, data.identifier);
		if (!('human' in this)) {
			// NOTE: we append this.id so that each instance has a unique id.
			// Otherwise the second, third,... instances do not respond to events.
			this.human = new HumanAPI(IFRAME_ID + this.id);
			console.log('usc_biodigital> CREATED human:', this.human, 'this.id=', this.id);
			var _this = this;
			this.human.send("camera.info", function(camera) {
				console.log("Gathering camera info:");
				console.log(JSON.stringify(camera));
				_this.currentZoom = camera.zoom;
			});
		}

		if (eventType === "pointerPress" && (data.button === "left")) {
			//console.log("TEST x:" + position.x + " y: " + position.y);	
			var _this = this;
			//console.log(this.element.clientHeight);
			var posY = position.y;
			var posX = position.x;
			// click
			if (this.tool ==  "default"){
				this.dragging = true;
				this.dragFromX = position.x;
				this.dragFromY = position.y;
			} else if (inButton(posX, posY, "submitBtn")){
				console.log("You got the submit button");
			} else if (inButton(posX, posY, "nextBtn")){
				console.log("You got the next button");
			} else {
		    	_this.human.send("scene.pick", { x: posX, y: posY}, function (hit) {
					if (hit) {
						var obj = JSON.parse(JSON.stringify(hit))
						var str = obj.objectId;
						console.log("Hit: " + JSON.stringify(hit));
						//console.log(str);
						var nm = str + _this.id;
						var el = document.getElementById(nm);	
						if (el == null){
							hit = null;
						} else {
							el.style.backgroundColor = "purple";
							_this.correctAnswers++;
							console.log(_this.correctAnswers + " " + _this.numQuestions);
							// finish quiz
							if (_this.correctAnswers == _this.numQuestions){
								var quizClock = this.interval;
								console.log(quizClock);
								_this.pauseClock();
								var win = document.createElement('p');
								win.style.color = "green";
								win.appendChild(document.createTextNode("YOU WIN!"));
								_this.humanQuiz.appendChild(win);	
								//Send the Quiz data to MongoDB Database
								console.log("score = 3");
								var xhr = new XMLHttpRequest();
								xhr.open('GET', 'http://localhost:3000?id=blank+,+score=3+,+quizClock='+quizClock);
								xhr.onreadystatechange = function () {
									var DONE = 4; // readyState 4 means the request is done.
									var OK = 200; // status 200 is a successful return.
									if (xhr.readyState === DONE) {
										if (xhr.status === OK) 	{
											console.log(xhr.responseText); // 'This is the returned text.'
										} else {
											console.log('error'+xhr.responseText);
										}
									} else {
										console.log('Error: ' + xhr.status); // An error occurred during the request.
									}
								}
								xhr.send(null);	
							}
						/*} else {
							if (_this.isQuiz){
								_this.missed++;
								document.getElementById("missed" + _this.id).textContent = "Missed: " + _this.missed;
							}
						}*/
						}
					}
					if (!hit) {
						if (_this.isQuiz){
							_this.missed++;
							document.getElementById("missed" + _this.id).textContent = "Missed: " + _this.missed;
						}
						console.log("Miss");
					}
				});
				// todo is this needed?
				_this.human.send("scene.pick", {x: posX, y: posY, triggerActions: true});
			}
		} else if (eventType === "pointerMove" && this.dragging) {
			if (this.tool ==  "default"){
				// move (orbit camera)
				var dx = (position.x - this.dragFromX) * -1;
				var dy = position.y - this.dragFromY;
				this.human.send('camera.orbit', { yaw: dx, pitch: dy });
				this.dragFromX = position.x;
				this.dragFromY = position.y;
				this.refresh(date);
			}
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			// click release

			this.dragging = false;
		} else if (eventType === "pointerScroll") {
			// Scroll events for zoom
			this.zoomInOut((data.wheelDelta / 10000.0) * -1);
			this.refresh(date);
		} else if (eventType === "keyboard") {
			if (data.character === "r") {
				this.human.send('camera.reset');
				this.refresh(date);
			}
		} else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") {
				// left
				this.human.send('camera.pan', { x: -PAN_STEP, y: 0.0 });
				// console.log('usc_biodigital> camera.pan left');
				this.refresh(date);
			} else if (data.code === 38 && data.state === "down") {
				// up
				this.human.send('camera.pan', { x: 0.0, y: -PAN_STEP });
				// console.log('usc_biodigital> camera.pan up');
				this.refresh(date);
			} else if (data.code === 39 && data.state === "down") {
				// right
				this.human.send('camera.pan', { x: PAN_STEP, y: 0.0 });
				// console.log('usc_biodigital> camera.pan right');
				this.refresh(date);
			} else if (data.code === 40 && data.state === "down") {
				// down
				this.human.send('camera.pan', { x: 0.0, y: PAN_STEP });
				// console.log('usc_biodigital> camera.pan down');
				this.refresh(date);
			}	
		} else if (eventType === "pointerDblClick") {
				//Add code to switch between pointer options
		} else if (eventType === "widgetEvent") {
			console.log(data.identifier);
			switch (data.identifier) {
				case "Reset":
					console.log("usc_biodigital> Reset Widget");
					this.reset();
					break;
				case "Quiz":
					console.log("Quiz started!");
					this.btnQuizClick();
					break;
				case "PlayButton":
					console.log('usc_biodigital> Play Widget');
					this.human.send("timeline.play", { loop: true });
					break;
				case "play-pause":
					console.log('usc_biodigital> Pause Widget');
					this.human.send("timeline.pause", { loop: true });
					break;
				case "Next":
					console.log('usc_biodigital> Next Widget');
					this.human.send("timeline.nextChapter");
					break;
				case "Prev":
					console.log('usc_biodigital> Previous Widget');
					this.human.send("timeline.previousChapter");
					break;
				case "ViewType":
					console.log(data.value);
					switch (data.value) {
						case "Norm":
							console.log('usc_biodigital> Normal Option');
							this.human.send("scene.disableXray");
							this.human.send("scene.selectionMode", "highlight");
							break;
						case "X-ray":
							console.log('usc_biodigital> XRay Option');
							this.human.send("scene.enableXray");
							this.human.send("scene.selectionMode", "highlight");
							break;
						case "Iso":
							console.log('usc_biodigital> Isolate Option');
							this.human.send("scene.selectionMode", "isolate");
							break;
						default:
							console.log("Error: unknown option");
							break;
					}	
				 	break;
				case "PointerType":
					switch (data.value) {
						case "Sel":
							this.tool = "highlight";
							console.log('usc_biodigital> Select Option');
							this.changeTool();
							break;
						case "Dis":
							this.tool = "dissect";
							console.log('usc_biodigital> Dissect Option');
							this.changeTool();
							break;
						case "Rota":
							this.tool = "default";
							console.log('usc_biodigital> Dissect Option');
							this.changeTool();
							break;
						//For future development
						/*case "Pan":
							this.tool = "pan";
							console.log('usc_biodigital> Pan Option');
							this.changeTool();
							break;*/
						default:
							console.log("Error: unknown option");
							break;
					}
					break;
				case "ModelType":
					switch (data.value) {
						case "Heart":
							console.log("usc_biodigital> Reinitalising with heart model");
							this.humanIframe.src = "https://human.biodigital.com/widget?be=1to1&background=255,255,255,51,64,77&dk="+this.state.dk;
							this.reset();
							this.pointerTypeRadioButton.value = "Rota";
							break;
						case "Male":
							console.log("usc_biodigital> Reinitalising with male model");
							this.humanIframe.src = "https://human.biodigital.com/widget?be=1ud8&background=255,255,255,51,64,77&dk="+this.state.dk;
							this.reset();
							this.pointerTypeRadioButton.value = "Rota";
							break;
						default:
							console.log("Error: unknown option");
							break;
					}
					break;
				default:
					console.log("Error: unkown widget");
					console.log(eventType, position, user_id, data, date);
					break;
			}
			this.refresh(date);
		}
	},

	zoomInOut: function(delta) {
		// Zoom IN (positive delta) or OUT (negative delta)
		// Zoom levels are from 0.0 .. 1.0, so use small delta values!
		this.currentZoom = Math.max(0.0, Math.min(1.0, this.currentZoom + delta));
		this.human.send('camera.zoom', this.currentZoom);
		console.log('usc_biodigital> scroll to zoom', this.currentZoom);
	}
});