import React from "react";
import {Route, Switch, Link, matchPath} from "react-router-dom";
import {Notification} from "react-notification";

import BuildsList from "./BuildsList.js";
import BuildDetails from "./BuildDetails.js";
import BuildStatistics from "./BuildStatistics.js";

import "./BuildCommon.css";

import {Loading, Errors, withFetcher} from "../utils.js";


export default withFetcher(class BuildInfo extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			data: null,
			loading: false,
			error: false,
			notification: "",
			notificationShow: false,
		};

		this.handleEvent = this.handleEvent.bind(this);
		this.hideNotification = this.hideNotification.bind(this);

	}

	handleEvent(e){
		const {event, data: build} = JSON.parse(e.data);
		if(this.state.data && event === "status"){
			const cond = (v)=>v.build.ref === build.ref;
			const el = this.state.data.list.find(cond);

			const match = matchPath(this.props.location.pathname, {
				path: "/:proj/:hash",
				exact: true
			})

			let notification = 
				build.status === "success" ? <span>Build finished: <Link onClick={this.hideNotification} to={build.ref}>{build.ref.substr(0,7)}</Link></span> :
				build.status === "error"   ? <span>Build failed: <Link   onClick={this.hideNotification} to={build.ref}>{build.ref.substr(0,7)}</Link></span> : 
					this.state.notification;

			if(match && match.params && match.params.hash === build.ref){
				notification = this.state.notification;
			}

			if(!el) {
				this.load();
			} else {
				this.setState({
					notification: notification,
					notificationShow: notification !== this.state.notification,
					data: {
						...this.state.data,
						list: [
							...this.state.data.list.filter((v)=>!cond(v)),
							{
								...el,
								build: {
									...build,
									start: new Date(build.start)
								}
							}
						].sort((a,b) => b.commit.date - a.commit.date)
					}
				});
			}
		}
	}

	componentDidMount(){
		this.load(true);

		this.props.events.addEventListener(this.props.match.params.proj, this.handleEvent);
	}

	componentWillUnmount(){
		this.props.events.removeEventListener(this.props.match.params.proj, this.handleEvent);
	}


	hideNotification() {
		this.setState({
			notificationShow: false
		});
	}

	load(inital){
		if(inital)
			this.setState({loading: true});

		this.props.fetch(`/api/${this.props.match.params.proj}/`)
			.then(res => res.json())
			.then(({list, ...r}) => this.setState(
				{
					loading: false,
					error: false,
					data: {
						list: list.map(
								({commit, build }) => (
									{	
										commit: {
											...commit,
											date: new Date(commit.date),
										},
										build: build && {
											...build,
											start: new Date(build.start),
										}
									}
								)).sort((a,b) => b.commit.date - a.commit.date),
						...r
					}
				}),(res) => this.setState(
				{
					loading: false,
					error: res.status
				}));
	}

	render(){
		const pass = {
			data: this.state.data,
			reload: () => this.load()
		};
		return (
			this.state.error ? (
				this.state.error === 404 ?
					<Errors>There is no project called&nbsp;<i>{this.props.match.params.proj}</i></Errors> :
					<Errors>Couldn't connect to server,&nbsp;<a onClick={()=>this.load(true)}>click to retry</a></Errors>
			) :
			this.state.loading || !this.state.data ? <Loading/> :
			<React.Fragment>
				<Switch>
					<Route path={"/:proj/"} exact strict render={(props)=> <BuildsList info={pass} {...props}/>}/>
					<Route path={"/:proj/stats"} exact strict render={(props)=> <BuildStatistics info={pass} {...props}/>}/>
					<Route path={"/:proj/:hash"} exact render={(props)=> <BuildDetails events={this.props.events} info={pass} {...props}/>}/>
					<Route render={() => (<Errors>Specify a project in the URL!</Errors>)}/>
				</Switch>
				<Notification
					isActive={this.state.notificationShow}
					message={this.state.notification}
					action="Dismiss"
					// title="Title!"
					// onDismiss={this.hideNotification}
					onClick={() => this.setState({ notificationShow: false })}
				/>
			</React.Fragment>

		);
	}
		
});