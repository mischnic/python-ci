import React from "react";
import ReactDOM from "react-dom";
import {BrowserRouter as Router} from "react-router-dom";

import registerServiceWorker from "./registerServiceWorker";
import "./EventSource.js";

import App from "./App.js";

const sw = registerServiceWorker();

if(sw){
	sw.then(console.log,console.error)
}

ReactDOM.render(
	<Router>
		<App sw={sw}/>
	</Router>, document.getElementById("root"));

