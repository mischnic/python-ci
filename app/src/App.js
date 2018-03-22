import React from "react";
import PropTypes from "prop-types";
import {Route, Redirect, Switch, Link, NavLink, withRouter} from "react-router-dom";

import {NotificationStack} from "react-notification";
import {OrderedSet} from 'immutable';

import {isLoggedIn, logout, getJWT} from "./auth.js";
import {PrivateRoute, Errors} from "./utils.js";

import BuildInfo from "./pages/BuildInfo.js";
import ProjectList from "./pages/ProjectList.js";
import Login from "./pages/Login.js";
import SettingsPage from "./pages/SettingsPage.js";

import "./index.css";

const withNotificationsProvider = (Component) =>
	class NotificationsProvider extends React.Component {
		constructor(props){
			super(props);
			this.state = {
				notifications: OrderedSet()
			};

			this.notify = this.notify.bind(this);
			this.createNotification = this.createNotification.bind(this);
			this.removeNotification = this.removeNotification.bind(this);
			window.notify = this.notify;
		}

		getChildContext() {
			return {
				notify: this.notify,
				removeNotification: this.removeNotification
			};
		}

		static childContextTypes = {
			notify: PropTypes.func,
			removeNotification: PropTypes.func
		};

		notify(msg, duration){
			const n = this.createNotification(msg, duration);
			this.setState({
				notifications: this.state.notifications.add(n)
			});
			return n.key;
		}

		createNotification(msg, duration = 4000){
			const newID = Math.random().toString(36).substr(2, 9);
			return {
				message: msg,
				key: newID,
				action: 'Dismiss',
				dismissAfter: duration,
				onClick: () => this.removeNotification(newID),
			};
		}

		removeNotification(id) {
			this.setState({
				notifications: this.state.notifications.filter(n => n.key !== id)
			})
		}

		render(){
			return (
			<React.Fragment>
				<Component {...this.props} notify={this.notify}/>
				<NotificationStack
					notifications={this.state.notifications.toArray()}
					onDismiss={notification => this.setState({
						notifications: this.state.notifications.delete(notification)
					})} />
			</React.Fragment>);
		}
	};



class App extends React.Component {
	constructor(props){
		super(props);
		this.key = this.key.bind(this);

		if(this.props.sw){
			this.props.sw.then((msg)=>{
				if(msg === "ready"){
					this.props.notify(
						"Ready to work offline", 6000
					);
				} else if(msg === "update") {
					this.props.notify(
						<span>An update is available, <a onClick={()=>window.location.reload()}>reload</a>?</span>, 6000
					);
				} else if(msg === "offline") {
					this.props.notify(
						"Offline, only cached content available", 6000
					);
				}
			});
		}
	}

	subscribe(){
		this.events = new EventSource(
			(process.env.NODE_ENV === "development" ?
			`${window.location.protocol}//${window.location.hostname}:5000/subscribe` :
			`${window.location.origin}/api/subscribe`) + `?token=${getJWT()}`
		);
	}

	key(e){
		if(e.key === "Backspace"){
			if(!e.shiftKey){
				this.props.history.goBack();
			} else {
				this.props.history.goForward();
			}
		} else if(e.key === "Enter"){
			e.target.click();
		}
	}

	componentDidMount(){
		document.querySelector("body").addEventListener("keydown", this.key);
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
		document.querySelector("body").removeEventListener("keydown", this.key);
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
					<Link className="title" to="/" tabIndex="-1">Python-CI</Link>
					{
						isLoggedIn() ?
						<React.Fragment>
							<span className="account" onClick={()=>logout() || this.logout()}>
								<Link tabIndex="100" to="/login">Logout</Link>
							</span>
							<NavLink tabIndex="90" activeStyle={{display: "none"}} to="/settings" className="fa fa-cog" style={{fontSize: "1.4em"}}/>
						</React.Fragment>
						:
						<span className="account">
							<Link to="/login">Login</Link>
						</span>
					}
				</div>
				<div className="main">
					<Switch>
						<Redirect from="/index.html" to="/"/>
						<Route path="/login" render={() => <Login afterLogin={()=>this.login()}/> } />

						<PrivateRoute path="/" strict exact render={(props)=><ProjectList {...props}/>} />
						<PrivateRoute path="/settings" strict render={(props)=><SettingsPage/>} />

						<PrivateRoute path="/:proj" exact strict render={(props)=><Redirect to={props.match.url+"/"}/>}/>
						<PrivateRoute path="/:proj/" strict render={(props)=><BuildInfo {...props} events={this.events}/>} />

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

export default withRouter(withNotificationsProvider(App));
