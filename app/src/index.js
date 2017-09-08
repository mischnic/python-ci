import React from "react";
import ReactDOM from "react-dom";
import {BrowserRouter as Router, Route, Redirect, Switch} from "react-router-dom";

import {isLoggedIn} from "./auth.js";

import "./index.css";
// import registerServiceWorker from "./registerServiceWorker";

import BuildInfo from "./pages/BuildInfo.js";

import Login from "./pages/Login.js";

function PrivateRoute({component: Component, render, authed = isLoggedIn, ...rest}) {
	return (
		<Route
			{...rest}
			render={(props) => authed()
				? ( Component ? <Component {...props}/> : render(props))
				: <Redirect to={{pathname: "/login", state: {from: props.location}}} />}
		/>
	);
}

ReactDOM.render(
	<Router>
		<div id="app">
			<div className="header">
				<span className="title">Python-CI</span>
				{
					isLoggedIn() ?
					<span className="account" onClick={null}>Logout</span>
					:
					<span className="account" onClick={null}>Login</span>
				}
			</div>
			<div className="main">
				<Switch>
					<Route path="/login" render={() => <Login/> } />
					<PrivateRoute path="/:proj/" strict={true} component={BuildInfo} />
					<Route render={() => (<p>Specify a project in the URL!</p>)}/>
				</Switch>
			</div>
		</div>
	</Router>, document.getElementById("root"));

// registerServiceWorker();
