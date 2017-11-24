import React from "react";
import {Link} from "react-router-dom";
import "./BuildsList.css";
import "./BuildCommon.css";

import {formatTime, RelDate} from "../utils.js";
import {GitUser} from "./BuildCommon.js";
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
								<GitUser name={commit.author_name} avatar={commit.author_avatar}/>
							</div>
							<div>{commit.msg.split("\n")[0]}</div>
						</div>
						<div className="commitData">
							<div>
								{commit.ref.substring(0,7)}
							</div>
							<div><RelDate date={commit.date}/></div>
						</div>
						<div className="buildInfo">
							{build.duration ? <div>took {formatTime(build.duration)}</div> : null}
							<div>{build.status === "pending" ? "started" : "ran"} <RelDate date={build.start}/></div>
						</div>
					</CustomLink>
				)	
			}
		</ul>
	</div>;

export default BuildsList;