import React from "react";
import PropTypes from "prop-types";
import {Route, Switch, Link, matchPath} from "react-router-dom";

import BuildsList from "./BuildsList.js";
import BuildDetails from "./BuildDetails.js";
import BuildStatistics from "./BuildStatistics.js";

import "./BuildCommon.css";

import {Loading, Errors, withFetcher} from "../utils.js";

export default withFetcher(class BuildInfo extends React.Component {
	static contextTypes = {
	  notify: PropTypes.func
	};

	constructor(props){
		super(props);

		this.state = {
			data: null,
			loading: false,
			error: false
		};

		this.handleEvent = this.handleEvent.bind(this);
	}

	handleEvent(e){
		const {event, data: build} = JSON.parse(e.data);
		if(this.state.data && event === "status"){
			const cond = (v) => v.commit.ref === build.ref;
			const el = this.state.data.list.find(cond);

			const match = matchPath(this.props.location.pathname, {
				path: "/:proj/:hash",
				exact: true
			})

			let notification =
				build.status === "success" ? <span>Build finished: <Link to={build.ref}>{build.ref.substr(0,7)}</Link></span> :
				build.status === "error"   ? <span>Build failed: <Link   to={build.ref}>{build.ref.substr(0,7)}</Link></span> :
					null;

			if(!(match && match.params && match.params.hash === build.ref) && notification){
				this.context.notify(notification);
			}


			if("start" in build){
				build.start = new Date(build.start)
			}

			if(!el) {
				this.load();
			} else {
				this.setState({
					data: {
						...this.state.data,
						list: [
							...this.state.data.list.filter((v)=>!cond(v)),
							{
								...el,
								build: {
									...el.build,
									...build
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

		this.props.events.onerror = () => {
			this.props.events._hadError = true;
		}

		this.props.events.onopen = () => {
			if(this.props.events._hadError){
				this.context.notify(<span>Reconnected to server, <a onClick={this.hideNotification}>reload</a>?</span>);
				this.props.events._hadError = false;
			}
		};
	}

	componentWillUnmount(){
		this.props.events.removeEventListener(this.props.match.params.proj, this.handleEvent);
		this.props.events.onopen = undefined;
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
			</React.Fragment>

		);
	}
		
});