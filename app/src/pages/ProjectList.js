import React from "react";

import {api, Loading} from "../utils.js";
import CustomLink from "../CustomLink.js"

import "./ProjectList.css"

function hash(str) {
	let hash = 5361,
	i = str.length;

	while(i) {
		hash = (hash * 33) ^ str.charCodeAt(--i);
	}

	return hash >>> 0;
}

function strToColor(str){
	return Math.round(hash(str)).toString(16).substring(0,6);
}


class ProjectList extends React.Component {
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
		
		api(this, `/api/`)
			.then(res => res.json())
			.then((d) => this.setState(
				{
					loading: false,
					data: d
				}),() => this.setState(
				{
					loading: false,
					error: true
				}));
	}

	render(){
		return (
			this.state.error ? <span>Error loading commits, <a onClick={()=>this.load(true)}>click to retry</a></span> :
			this.state.loading || !this.state.data ? <Loading/> :
			<div className="projectList">{
				this.state.data.map(proj=>(
					<CustomLink type="div" to={proj+"/"} className="project" key={proj} style={{
						backgroundColor: `#${strToColor(proj)}`
					}}>{proj}</CustomLink>
				))
			}</div>

		);
	}
		
}

export default ProjectList;