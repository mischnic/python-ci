import React from "react";

import BuildsList from "./BuildsList.js";
import BuildDetails from "./BuildDetails.js";

import {Route, Switch} from "react-router-dom";

import {Loading, withFetcher} from "../utils.js";

const addProps = (Component, props) => (p) => (
	<Component {...props} {...p}>{p.children}</Component>
);

export default withFetcher(class BuildInfo extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			data: null,
			loading: false,
			error: false
		};

		// if(!props.match.url.endsWith("/")){
		// 	props.history.replace(props.match.url+"/");
		// }
	}

	componentDidMount(){
		this.load(true);
	}

	load(inital){
		if(inital)
			this.setState({loading: true});
		
		this.props.fetch(`/api/${this.props.match.params.proj}/`)
			.then(res => res.json())
			.then(({list, ...r}) => this.setState(
				{
					loading: false,
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
								)).sort(
								(a,b) => a.commit.date < b.commit.date),
						...r
					}
				}),() => this.setState(
				{
					loading: false,
					error: true
				}));
	}

	render(){
		const pass = {
			data: this.state.data,
			reload: () => this.load()
		};
		return (
			this.state.error ? <span>Error loading commits, <a onClick={()=>this.load(true)}>click to retry</a></span> :
			this.state.loading || !this.state.data ? <Loading/> :
			<Switch>
				<Route path={"/:proj/"} exact={true} strict={true} component={addProps(BuildsList, {key: "BuildsList", info: pass})}/>
				<Route path={"/:proj/:hash"} component={addProps(BuildDetails, {key: "BuildDetails", info: pass})}/>
				<Route render={() => (<p>Specify a project in the URL!</p>)}/>
			</Switch>
		);
	}
		
});