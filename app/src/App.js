import React from "react";
import {Route, Redirect, Switch, Link} from "react-router-dom";

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

class App extends React.Component {
	componentWillMount(){
		this.events = new EventSource(
			process.env.NODE_ENV === "development" ? 
			`${window.location.protocol}//${window.location.hostname}:5000/subscribe` :
			`${window.location.origin}/api/subscribe`
		);
	}

	componentWillUnmount(){
		this.events.close();
	}

	render(){
		return (
			<div id="app">
				<div className="header">
					<Link className="title" to="/">Python-CI</Link>
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
						<PrivateRoute path="/" strict exact render={(props)=><ProjectList {...props}/>} />
						<PrivateRoute path="/:proj/" strict render={(props)=><BuildInfo {...props} events={this.events}/>} />
						<Redirect from="/index.html" to="/"/>
						<Route render={()=><span>Not found</span>}/>
					</Switch>
				</div>
			</div>)
	}
}

export default App;
