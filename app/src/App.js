import React from "react";
import {Route, Redirect, Switch} from "react-router-dom";

import {isLoggedIn, logout} from "./auth.js";

import CustomLink from "./CustomLink.js";

import BuildInfo from "./pages/BuildInfo.js";
import ProjectList from "./pages/ProjectList.js";
import Login from "./pages/Login.js";

import "./index.css";


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

export default function App(){
	return (
		<div id="app">
			<div className="header">
				<span className="title">Python-CI</span>
				{
					isLoggedIn() ?
					<span className="account" onClick={logout}><CustomLink type="span" to="/login">Logout</CustomLink></span>
					:
					<span className="account"><CustomLink type="span" to="/login">Login</CustomLink></span>
				}
			</div>
			<div className="main">
				<Switch>
					<Route path="/login" render={() => <Login/> } />
					<PrivateRoute path="/" strict exact component={ProjectList} />
					<PrivateRoute path="/:proj/" strict component={BuildInfo} />
					<Redirect from="/index.html" to="/"/>
					<Route render={()=><span>Not found</span>}/>
				</Switch>
			</div>
		</div>)
}
