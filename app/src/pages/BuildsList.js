import React from "react";
import {Link} from "react-router-dom";
import "./BuildsList.css";
import "./Build.css";

import {humanDate, formatTime, strToColor} from "../utils.js";
import CustomLink from "../CustomLink.js";

const BuildsList = (props) =>
	<div>
		<h1><Link to="..">Projects</Link> > {props.match.params.proj}</h1>
		<ul className="buildsList">
			{
				props.info.data.list.map( ({commit, build}) => 
					<CustomLink type="li" to={commit.ref} key={commit.ref} className={`window buildStatus ${build.status}`}>
						<div className="commitInfo">
							<div>
								<img className="avatar" alt="" style={!commit.author_avatar ? {backgroundColor: "#"+strToColor(commit.author_name)} : null} src={commit.author_avatar}/><span>{commit.author_name}</span>
							</div>
							<div>{commit.msg.split("\n")[0]}</div>
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
	</div>;

export default BuildsList;