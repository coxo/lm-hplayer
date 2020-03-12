import React, { useRef, useEffect, useState, useCallback } from 'react'
import VideoEvent from './event'
import { getVideoType, createFlvPlayer, createHlsPlayer } from './util'
import IconFont from './iconfont'
import ContrallerBar from './contraller_bar'
import ContrallerEvent from './event/contrallerEvent'
import VideoMessage, { NoSource } from './message'
import TimeLine from './time_line'
import ErrorEvent from './event/errorEvent'
import DragEvent from './event/dragEvent'
import Api from './api'
import LiveHeart from './live_heart'
import PropTypes from 'prop-types'
import './style/index.less'
import Players from './h265/player'

function SinglePlayer({ type, file, h265lib, className, autoPlay, muted, poster, playsinline, loop, preload, children, onInitPlayer, ...props }) {
  const playContainerRef = useRef(null)
  const [playerObj, setPlayerObj] = useState(null);
  const [canvsShow, setcanvsShow] = useState(false);
  const [canPlay, setcanPlay] = useState(true);
  const DEMUX_MSG_EVENT = 'demux_msg'
  
  let isfirst = false;
  useEffect(() => {
    if (!file) {
      return
    }
    const playerObject = {
      playContainer: playContainerRef.current,
      video: playContainerRef.current.querySelector('video')
    }
    const formartType = getVideoType(file)

    if (formartType === 'flv' || type === 'flv') {
      playerObject.flv = createFlvPlayer(playerObject.video, { ...props, file });

      playerObject.flv.on(DEMUX_MSG_EVENT, (data) => {
        if (data !== 7) {
          !isfirst && setcanvsShow(true);
          isfirst = true;
        }
      });
    }

    if (formartType === 'm3u8' || type === 'hls') {
      playerObject.hls = createHlsPlayer(playerObject.video, file)
    }

    if (!['flv', 'm3u8'].includes(formartType) || type === 'native') {
      playerObject.video.src = file;
    }

    playerObject.event = new VideoEvent(playerObject.video)
    playerObject.api = new Api(playerObject)
    setPlayerObj(playerObject)

    if (onInitPlayer) {
      onInitPlayer(Object.assign({}, playerObject.api.getApi(), playerObject.event.getApi()))
    }

    return () => {
      if (playerObject.api) {
        playerObject.api.unload()
      }
    }
  }, [file])

  const PlayerA = new Players(h265lib);

  const HplayCreater = useCallback(() => {
    PlayerA.play(file, document.getElementById('playCanvas'), function (e) {
      if (e.error == 1) {
      }
    }, 512 * 1024, true);
  }, [canvsShow]);

  useEffect(() => {
    if (canvsShow) {
      HplayCreater();
    }
  }, [canvsShow])

  const hplay = useCallback(() => {
    PlayerA.pause();
    setcanPlay(false)
  }, [file, canvsShow]);

  const hstop = useCallback(() => {
    PlayerA.resume();
    setcanPlay(true)
  }, [file, canvsShow]);

  const fullscreen = useCallback(() => {
    PlayerA.fullscreen();
  }, [file, canvsShow]);

  return (
    <>
      {
        !canvsShow ? <div className={`lm-player-container ${className}`} ref={playContainerRef}>
          <div className="player-mask-layout">
            <video autoPlay={autoPlay} preload={preload} muted={muted} poster={poster} controls={false} playsInline={playsinline} loop={loop} />
          </div>
          <VideoTools
            playerObj={playerObj}
            isLive={props.isLive}
            hideContrallerBar={props.hideContrallerBar}
            errorReloadTimer={props.errorReloadTimer}
            scale={props.scale}
            snapshot={props.snapshot}
            leftExtContents={props.leftExtContents}
            leftMidExtContents={props.leftMidExtContents}
            rightExtContents={props.rightExtContents}
            rightMidExtContents={props.rightMidExtContents}
            draggable={props.draggable}
          />
          {children}
        </div> :
          <div className="h265-bar" style={{ position: "relative" }}>
            <canvas id="playCanvas" className='player-webgl' width="800" height="400"></canvas>
            <div className={`contraller-bar-layout `}>
              {canPlay ? <IconFont title="播放" onClick={hplay} type={'lm-player-Pause_Main'} />
                :
                <IconFont title="播放" onClick={hstop} type={'lm-player-Play_Main'} />
              }
              {/* <IconFont title="播放" onClick={hplayOrstop} type={ canPlay ?  'lm-player-Pause_Main' : 'lm-player-Play_Main'} /> */}
              <IconFont title={true ? '窗口' : '全屏'} onClick={fullscreen} type={true ? 'lm-player-ExitFull_Main' : 'lm-player-Full_Main'} />
            </div>
          </div>
      }
    </>

  )
}

function VideoTools({
  playerObj,
  draggable,
  isLive,
  hideContrallerBar,
  scale,
  snapshot,
  leftExtContents,
  leftMidExtContents,
  rightExtContents,
  rightMidExtContents,
  errorReloadTimer
}) {
  if (!playerObj) {
    return <NoSource />
  }
  return (
    <>
      <VideoMessage api={playerObj.api} event={playerObj.event} />
      {draggable && <DragEvent playContainer={playerObj.playContainer} api={playerObj.api} event={playerObj.event} />}
      {true && (
        <ContrallerEvent event={playerObj.event} playContainer={playerObj.playContainer}>
          <ContrallerBar
            api={playerObj.api}
            event={playerObj.event}
            playContainer={playerObj.playContainer}
            video={playerObj.video}
            snapshot={snapshot}
            rightExtContents={rightExtContents}
            rightMidExtContents={rightMidExtContents}
            scale={scale}
            isHistory={false}
            isLive={isLive}
            leftExtContents={leftExtContents}
            leftMidExtContents={leftMidExtContents}
          />
          {!isLive && <TimeLine api={playerObj.api} event={playerObj.event} />}
        </ContrallerEvent>
      )}
      <ErrorEvent flv={playerObj.flv} hls={playerObj.hls} api={playerObj.api} event={playerObj.event} errorReloadTimer={errorReloadTimer} />
      {isLive && <LiveHeart api={playerObj.api} />}
    </>
  )
}

SinglePlayer.propTypes = {
  file: PropTypes.string.isRequired, //播放地址 必填
  isLive: PropTypes.bool, //是否实时视频
  errorReloadTimer: PropTypes.number, //视频错误重连次数
  type: PropTypes.oneOf(['flv', 'hls', 'native']), //强制视频流类型
  onInitPlayer: PropTypes.func,
  draggable: PropTypes.bool,
  hideContrallerBar: PropTypes.bool,
  scale: PropTypes.bool,
  muted: PropTypes.string,
  autoPlay: PropTypes.bool,
  playsInline: PropTypes.bool,
  preload: PropTypes.string,
  poster: PropTypes.string,
  loop: PropTypes.bool,
  snapshot: PropTypes.func,
  className: PropTypes.string,
  rightExtContents: PropTypes.element,
  rightMidExtContents: PropTypes.element,
  leftExtContents: PropTypes.element,
  leftMidExtContents: PropTypes.element,
  flvOptions: PropTypes.object,
  flvConfig: PropTypes.object,
  children: PropTypes.element
}
SinglePlayer.defaultProps = {
  isLive: true,
  draggable: true,
  scale: true,
  errorReloadTimer: 5,
  muted: 'muted',
  autoPlay: true,
  playsInline: false,
  preload: 'auto',
  loop: false,
  hideContrallerBar: false
}

export default SinglePlayer
