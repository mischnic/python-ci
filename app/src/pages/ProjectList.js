import React from "react";

import {Loading, withFetcher, strToColor} from "../utils.js";
import CustomLink from "../CustomLink.js"

import "./ProjectList.css"


export default withFetcher(class ProjectList extends React.Component {
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
		
		this.props.fetch(`/api/`)
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
			<div>
				<h1>Projects</h1>
				<div className="projectList">
					{
						this.state.data.map(proj=>(
							<CustomLink type="div" to={proj+"/"} className="project" key={proj} style={{
								backgroundColor: `#${strToColor(proj)}`
							}}>{proj}</CustomLink>
						))
					}
				</div>
			</div>

		);
	}
		
});