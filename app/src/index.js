import React from "react";
import ReactDOM from "react-dom";
import {BrowserRouter as Router} from "react-router-dom";

import registerServiceWorker from "./registerServiceWorker";
import "./EventSource.js";

import App from "./App.js";


ReactDOM.render(
	<Router>
		<App/>
	</Router>, document.getElementById("root"));

registerServiceWorker();
