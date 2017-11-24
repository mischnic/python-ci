import React from "react";
import {Route, Redirect, Switch, Link} from "react-router-dom";

import {isLoggedIn, logout, getJWT} from "./auth.js";
import {PrivateRoute, Errors} from "./utils.js";
import CustomLink from "./CustomLink.js";
import CustomNavLink from "./CustomNavLink.js";

import BuildInfo from "./pages/BuildInfo.js";
import ProjectList from "./pages/ProjectList.js";
import Login from "./pages/Login.js";
import SettingsPage from "./pages/SettingsPage.js";

import "./index.css";


class App extends React.Component {

	subscribe(){
		this.events = new EventSource(
			(process.env.NODE_ENV === "development" ?
			`${window.location.protocol}//${window.location.hostname}:5000/subscribe` :
			`${window.location.origin}/api/subscribe`) + `?token=${getJWT()}`
		);
	}

	componentWillMount(){
		if(isLoggedIn() && !this.events){
			this.subscribe();
		}
	}

	componentWillUpdate(){
		if(isLoggedIn() && !this.events){
			this.subscribe();
		}
	}

	componentWillUnmount(){
		if(this.events){
			this.events.close();
		}
	}

	login(){
		if(this.events){
			this.events.close();
		}
		this.subscribe();
	}

	logout(){
		if(this.events){
			this.events.close();
		}
	}

	render(){
		return (
			<div id="app">
				<div className="header">
					<Link className="title" to="/">Python-CI</Link>
					{
						isLoggedIn() ?
						<span className="account" onClick={()=>logout() || this.logout()}>
							<CustomLink type="span" to="/login">Logout</CustomLink>
						</span>
						:
						<span className="account">
							<CustomLink type="span" to="/login">Login</CustomLink>
						</span>
					}
					{ isLoggedIn() && <CustomNavLink activeStyle={{display: "none"}} type="span" to="/settings" className="fa fa-cog" style={{fontSize: "1.4em"}}/> }
				</div>
				<div className="main">
					<Switch>
						<Route path="/login" render={() => <Login afterLogin={()=>this.login()}/> } />

						<PrivateRoute path="/" strict exact render={(props)=><ProjectList {...props}/>} />
						<PrivateRoute path="/settings" strict render={(props)=><SettingsPage/>} />

						<PrivateRoute path="/:proj" exact strict render={(props)=><Redirect to={props.match.url+"/"}/>}/>
						<PrivateRoute path="/:proj/" strict render={(props)=><BuildInfo {...props} events={this.events}/>} />

						<Redirect from="/index.html" to="/"/>
						<Route render={()=><Errors>
							<div style={{marginTop: "-5rem", textAlign: "center"}}>
								<div style={{fontSize: "13rem", marginBottom: "-1rem"}}>&#8253;</div>
								<big>404 - Not found</big>
							</div>
							</Errors>}/>
					</Switch>
				</div>
			</div>)
	}
}

export default App;
