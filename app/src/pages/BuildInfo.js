import React from "react";

import BuildsList from "./BuildsList.js";
import BuildDetails from "./BuildDetails.js";

import {Route, Switch} from "react-router-dom";

const addProps = (Component, props) => (p) => (
	<Component {...props} {...p}>{p.children}</Component>
);

class BuildInfo extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			commits: [],
			loading: false,
			error: false
		};
	}

	componentDidMount(){
		this.reload();
	}

	reload(){
		this.setState({loading: true});
		fetch(`/api/${this.props.match.params.proj}`)
			.then(res => !res.ok ? Promise.reject({status: res.status, text: res.statusText}) : res)
			.then(res => res.json())
			.then(res => this.setState(
				{
					loading: false,
					commits: res.map(
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
							(a,b) => a.commit.date < b.commit.date)
				}),() => this.setState(
				{
					loading: false,
					error: true
				}));
	}

	render(){
		return (
			this.state.loading ? <span>Loading...</span> :
			this.state.error ? <span>Error loading commits, <a onClick={()=>this.reload()}>retry</a></span> :
			<Switch>
				<Route path={"/:proj/"} exact={true} strict={true} component={addProps(BuildsList, {key: "BuildsList", info: this.state})}/>
				<Route path={"/:proj/:hash"} component={addProps(BuildDetails, {key: "BuildDetails", info: this.state})}/>
				<Route render={() => (<p>Specify a project in the URL!</p>)}/>
			</Switch>
		);
	}
		
}

export default BuildInfo;