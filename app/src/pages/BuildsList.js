import React from "react";
import {Link} from "react-router-dom";
import "./BuildsList.css";
import "./Build.css";

import {humanDate, formatTime} from "../utils.js";

class BuildsList extends React.Component {
	render(){
		return (
			<div>
				<h1>Builds: {this.props.match.params.proj}</h1>
				<ul className="buildsList">
					{
						this.props.info.data.list.map( ({commit, build}) => 
							<li key={commit.ref} className={`window buildStatus ${build.status}`}>
								<div>
									<div>
										<img className="avatar" alt="" src={commit.author.avatar_url}/><span>{commit.author.name}</span>
									</div>
									<div>{commit.msg}</div>
								</div>
								<div>
									<div>
										<a target="_blank" href={commit.url}>
											{commit.ref.substring(0,7)}
										</a> <i className="fa fa-external-link"/>
									</div>
									<div>{humanDate(commit.date)}</div>
								</div>
								<div>
									<div> <Link to={commit.ref}>build</Link></div>
									<div>
										{build.duration ? <div>took {formatTime(build.duration)}</div> : null}
										<div>{build.status === "pending" ? "started" : "ran"} {humanDate(build.start)}</div>
									</div>
								</div>
							</li>
						)	
					}
				</ul>
			</div>
		);
	}
		
}

export default BuildsList;