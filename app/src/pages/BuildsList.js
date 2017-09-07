import React from "react";
import {Link} from "react-router-dom";
import "./BuildsList.css";
import "./Build.css";

import {humanDate} from "../utils.js";

class Builds extends React.Component {
	render(){
		return (
			<div>
				<h1>Builds: {this.props.match.params.proj}</h1>
				<ul className="buildsList">
					{
						this.props.info.commits.map( ({commit, build}) => 
							<li key={commit.ref} className={`window build buildStatus ${build.status}`}>
								<div style={{flex: "0 0 50%", display: "flex"}}>
									<div style={{flex: "0 0 50%"}}><img className="avatar" alt="" src={commit.author.avatar_url}/>{commit.author.name}</div>
									<div style={{flex: "0 0 50%"}}>{commit.msg}</div>
								</div>
								<div style={{flex: "0 0 17%", display: "flex", flexDirection: "column"}}>
									<div><a href={commit.url}>{commit.ref.substring(0,7)}</a></div>
									<div>{humanDate(commit.date)}</div>
								</div>
								<div style={{flex: "0 0 33%", display: "flex", flexDirection: "column"}}>
									<div> <Link to={commit.ref}>build</Link></div>
									<div>took {build.duration.toFixed(1)} sec</div>
								</div>
							</li>
						)	
					}
				</ul>
			</div>
		);
	}
		
}

export default Builds;