import React from "react";
import {Link} from "react-router-dom";
import "./BuildsList.css";
import "./Build.css";

import {humanDate, formatTime} from "../utils.js";
import CustomLink from "../CustomLink.js";


class BuildsList extends React.Component {
	render(){
		return (
			<div>
				<h1><Link to="..">Projects</Link> > {this.props.match.params.proj}</h1>
				<ul className="buildsList">
					{
						this.props.info.data.list.map( ({commit, build}) => 
							<CustomLink type="li" to={commit.ref} key={commit.ref} className={`window buildStatus ${build.status}`}>
								<div className="commitInfo">
									<div>
										<img className="avatar" alt="" src={commit.author.avatar_url}/><span>{commit.author.name}</span>
									</div>
									<div>{commit.msg}</div>
								</div>
								<div className="commitData">
									<div>
										{commit.ref.substring(0,7)}
									</div>
									<div>{humanDate(commit.date)}</div>
								</div>
								<div className="buildInfo">
									{build.duration ? <div>took {formatTime(build.duration)}</div> : null}
									<div>{build.status === "pending" ? "started" : "ran"} {humanDate(build.start)}</div>
								</div>
							</CustomLink>
						)	
					}
				</ul>
			</div>
		);
	}
		
}

export default BuildsList;