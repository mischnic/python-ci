import React from "react";

import BuildsList from "./BuildsList.js";
import BuildDetails from "./BuildDetails.js";

import {Route, Switch} from "react-router-dom";

import {api, Loading} from "../utils.js";

const addProps = (Component, props) => (p) => (
	<Component {...props} {...p}>{p.children}</Component>
);

class BuildInfo extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			data: null,
			loading: false,
			error: false
		};
	}

	componentDidMount(){
		this.load(true);
	}

	load(inital){
		if(inital)
			this.setState({loading: true});
		
		api(this, `/api/${this.props.match.params.proj}`)
			.then(res => !res.ok ? Promise.reject({status: res.status, text: res.statusText}) : res)
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
			this.state.loading || !this.state.data ? <Loading/> :
			this.state.error ? <span>Error loading commits, <a onClick={()=>this.load(true)}>retry</a></span> :
			<Switch>
				<Route path={"/:proj/"} exact={true} strict={true} component={addProps(BuildsList, {key: "BuildsList", info: pass})}/>
				<Route path={"/:proj/:hash"} component={addProps(BuildDetails, {key: "BuildDetails", info: pass})}/>
				<Route render={() => (<p>Specify a project in the URL!</p>)}/>
			</Switch>
		);
	}
		
}

export default BuildInfo;