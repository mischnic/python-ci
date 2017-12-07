import React from "react";
import {Route, Switch} from "react-router-dom";

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
			error: false
		};

		this.handleEvent = this.handleEvent.bind(this);
	}

	handleEvent(e){
		const {event, data: build} = JSON.parse(e.data);
		if(this.state.data && event === "status"){
			const cond = (v)=>v.build.ref === build.ref;
			const el = this.state.data.list.find(cond);
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
								({commit: {date, ...rCommit}, build: {start, ...rBuild} }) => (
									{	
										commit: {
											date: new Date(date),
											...rCommit
										},
										build: {
											start: new Date(start),
											...rBuild
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
			<Switch>
				<Route path={"/:proj/"} exact strict render={(props)=> <BuildsList info={pass} {...props}/>}/>
				<Route path={"/:proj/stats"} exact strict render={(props)=> <BuildStatistics info={pass} {...props}/>}/>
				<Route path={"/:proj/:hash"} exact render={(props)=> <BuildDetails events={this.props.events} info={pass} {...props}/>}/>
				<Route render={() => (<Errors>Specify a project in the URL!</Errors>)}/>
			</Switch>
		);
	}
		
});