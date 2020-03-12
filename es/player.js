import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import flvjs from 'flv.hlm.js';
import * as Hls from 'hls.js';
import { isSupported } from 'hls.js';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';

class VideoEventInstance {
  constructor(video) {
    this.video = video;
    this.events = {};
    this.playerEvents = {};
  }

  on(eventName, handle) {
    this.events && this.events[eventName] ? this.events[eventName].listener.push(handle) : this.events[eventName] = {
      type: eventName,
      listener: [handle]
    };
  }

  addEventListener(eventName, handle) {
    if (this.video) {
      this.playerEvents[eventName] ? this.playerEvents[eventName].push(handle) : this.playerEvents[eventName] = [handle];
      this.video.addEventListener(eventName, handle, false);
    }
  }

  removeEventListener(eventName, handle) {
    if (this.video) {
      if (!this.playerEvents || !this.playerEvents[eventName]) {
        return;
      }

      let index = this.playerEvents[eventName].findIndex(v => v === handle);
      index > -1 && this.playerEvents[eventName].splice(index, 1);
      this.video.removeEventListener(eventName, handle, false);
    }
  }

  emit(eventName, ...data) {
    if (!this.events || !this.events[eventName]) {
      return;
    }

    this.events[eventName].listener.forEach(v => {
      v(...data);
    });
  }

  off(eventName, handle) {
    if (!this.events || !this.events.eventName) {
      return;
    }

    let index = this.events[eventName].listener.findIndex(v => v === handle);
    index > -1 && this.events[eventName].listener.splice(index, 1);
  }

  getApi() {
    return {
      on: this.on.bind(this),
      off: this.off.bind(this),
      emit: this.emit.bind(this)
    };
  }

  destroy() {
    Object.keys(this.playerEvents).forEach(key => {
      this.playerEvents[key].forEach(fn => {
        this.removeEventListener(key, fn);
      });
    });
    this.playerEvents = {};
    this.events = {};
  }

}

/**
 * 创建HLS对象
 * @param {*} video
 * @param {*} file
 */

function createHlsPlayer(video, file) {
  if (isSupported()) {
    const player = new Hls({
      liveDurationInfinity: true,
      levelLoadingTimeOut: 15000,
      fragLoadingTimeOut: 25000,
      enableWorker: true
    });
    player.loadSource(file);
    player.attachMedia(video);
    return player;
  }
}
/**
 * 创建FLV对象
 * @param {*} video
 * @param {*} options
 */

function createFlvPlayer(video, options) {
  const {
    flvOptions = {},
    flvConfig = {}
  } = options;

  if (flvjs.isSupported()) {
    const player = flvjs.createPlayer(Object.assign({}, flvOptions, {
      type: 'flv',
      url: options.file
    }), Object.assign({}, flvConfig, {
      enableWorker: true,
      // lazyLoad: false,
      // Indicates how many seconds of data to be kept for lazyLoad.
      // lazyLoadMaxDuration: 0,
      // autoCleanupMaxBackwardDuration: 3,
      // autoCleanupMinBackwardDuration: 2,
      // autoCleanupSourceBuffer: true,
      enableStashBuffer: false,
      stashInitialSize: 128,
      isLive: options.isLive || true
    }));
    player.attachMediaElement(video);
    player.load();
    return player;
  }
}
/**
 * 获取播放文件类型
 * @param {*} url
 */

function getVideoType(url) {
  const urlInfo = new URL(url);
  const path = `${urlInfo.origin}${urlInfo.pathname}`; // eslint-disable-next-line no-useless-escape

  const reg = /([^\.\/\\]+)\.(([a-z]|[0-9])+(\?\S+)?)$/i;
  const resultArr = reg.exec(path);

  if (!resultArr) {
    return url.indexOf('.flv') > -1 ? 'flv' : url.indexOf('.m3u8') > -1 ? 'm3u8' : 'native';
  }

  const suffix = resultArr[2].replace(resultArr[4], '');

  if (!suffix) {
    return url.indexOf('.flv') > -1 ? 'flv' : url.indexOf('.m3u8') > -1 ? 'm3u8' : 'native';
  }

  return suffix;
}
/**
 * 播放时间转字符串
 * @param {*} second_time
 */

function timeStamp(second_time) {
  let time = Math.ceil(second_time);

  if (time > 60) {
    let second = Math.ceil(second_time % 60);
    let min = Math.floor(second_time / 60);
    time = `${min < 10 ? `0${min}` : min}:${second < 10 ? `0${second}` : second}`;

    if (min > 60) {
      min = Math.ceil(second_time / 60 % 60);
      let hour = Math.floor(second_time / 60 / 60);
      time = `${hour < 10 ? `0${hour}` : hour}:${min < 10 ? `0${min}` : min}:${second < 10 ? `0${second}` : second}`;
    } else {
      time = `00:${time}`;
    }
  } else {
    time = `00:00:${time < 10 ? `0${time}` : time}`;
  }

  return time;
}
/**
 * 日期格式化
 * @param {*} timetemp
 */

function dateFormat(timetemp) {
  const date = new Date(timetemp);
  let YYYY = date.getFullYear();
  let DD = date.getDate();
  let MM = date.getMonth() + 1;
  let hh = date.getHours();
  let mm = date.getMinutes();
  let ss = date.getSeconds();
  return `${YYYY}.${MM > 9 ? MM : '0' + MM}.${DD > 9 ? DD : '0' + DD} ${hh > 9 ? hh : '0' + hh}.${mm > 9 ? mm : '0' + mm}.${ss > 9 ? ss : '0' + ss}`;
}
/**
 * 全屏
 * @param {*} element
 */

function fullscreen(element) {
  if (element.requestFullScreen) {
    element.requestFullScreen();
  } else if (element.webkitRequestFullScreen) {
    element.webkitRequestFullScreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
}
/**
 * exitFullscreen 退出全屏
 * @param  {Objct} element 选择器
 */

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}
/**
 * [isFullscreen 判断浏览器是否全屏]
 * @return [全屏则返回当前调用全屏的元素,不全屏返回false]
 */

function isFullscreen(ele) {
  if (!ele) {
    return false;
  }

  return document.fullscreenElement === ele || document.msFullscreenElement === ele || document.mozFullScreenElement === ele || document.webkitFullscreenElement === ele || false;
} // 添加 / 移除 全屏事件监听

function fullScreenListener(isAdd, fullscreenchange) {
  const funcName = isAdd ? 'addEventListener' : 'removeEventListener';
  const fullScreenEvents = ['fullscreenchange', 'mozfullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'];
  fullScreenEvents.map(v => document[funcName](v, fullscreenchange));
}
/**
 * 计算视频拖拽边界
 * @param {*} ele
 * @param {*} currentPosition
 * @param {*} scale
 */

function computedBound(ele, currentPosition, scale) {
  const data = currentPosition;
  const eleRect = ele.getBoundingClientRect();
  const w = eleRect.width;
  const h = eleRect.height;
  let lx = 0,
      ly = 0;

  if (scale === 1) {
    return [0, 0];
  }

  lx = w * (scale - 1) / 2 / scale;
  ly = h * (scale - 1) / 2 / scale;
  let x = 0,
      y = 0;

  if (data[0] >= 0 && data[0] > lx) {
    x = lx;
  }

  if (data[0] >= 0 && data[0] < lx) {
    x = data[0];
  }

  if (data[0] < 0 && data[0] < -lx) {
    x = -lx;
  }

  if (data[0] < 0 && data[0] > -lx) {
    x = data[0];
  }

  if (data[1] >= 0 && data[1] > ly) {
    y = ly;
  }

  if (data[1] >= 0 && data[1] < ly) {
    y = data[1];
  }

  if (data[1] < 0 && data[1] < -ly) {
    y = -ly;
  }

  if (data[1] < 0 && data[1] > -ly) {
    y = data[1];
  }

  if (x !== data[0] || y !== data[1]) {
    return [x, y];
  } else {
    return;
  }
}

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

function IconFont({
  type,
  className = '',
  ...props
}) {
  return React.createElement("i", _extends({
    className: `lm-player-iconfont ${type} ${className}`
  }, props));
}
IconFont.propTypes = {
  type: PropTypes.string,
  className: PropTypes.string
};

class Slider extends React.Component {
  constructor(props) {
    super(props);

    this.renderSliderTips = e => {
      const {
        renderTips
      } = this.props;

      if (!renderTips) {
        return;
      }

      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        const {
          x,
          width,
          top
        } = this.layoutDom.getBoundingClientRect();
        const tipsX = e.pageX - x;
        let percent = (e.pageX - x) / width;
        percent = percent < 0 ? 0 : percent > 1 ? 1 : percent;
        this.setState({
          tipsX,
          tipsY: top,
          showTips: true,
          tempValue: percent
        });
      }, 200);
    };

    this.hideSliderTips = () => {
      clearTimeout(this.timer);
      this.setState({
        showTips: false
      });
    };

    this.cancelPropagation = e => {
      e.stopPropagation();
    };

    this.startDrag = e => {
      e.stopPropagation();
      this.dragFlag = true;
      document.body.addEventListener('mousemove', this.moveChange);
      document.body.addEventListener('mouseup', this.stopDrag);
    };

    this.moveChange = e => {
      e.stopPropagation();
      const percent = this.computedPositionForEvent(e);
      this.setState({
        value: percent
      });
    };

    this.stopDrag = e => {
      e.stopPropagation();
      document.body.removeEventListener('mousemove', this.moveChange);
      document.body.removeEventListener('mouseup', this.stopDrag);
      this.dragFlag = false;
      let percent = this.state.value / 100;
      percent = percent < 0 ? 0 : percent > 1 ? 1 : percent;
      this.props.onChange && this.props.onChange(percent);
    };

    this.changeCurrentValue = event => {
      event.stopPropagation();
      const {
        width,
        x
      } = this.layoutDom.getBoundingClientRect();
      let percent = (event.pageX - x) / width;
      this.props.onChange && this.props.onChange(percent);
    };

    this.sliderDomRef = React.createRef();
    this.layoutDom = null;
    this.lineDom = null;
    this.dragDom = null;
    this.dragFlag = false;
    this.state = {
      value: this.props.currentPercent || 0,
      tempValue: 0,
      showTips: false,
      tipsX: 0,
      tipsY: 0
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!this.dragFlag) {
      this.setState({
        value: nextProps.currentPercent || 0
      });
    }
  }

  componentDidMount() {
    this.layoutDom = this.sliderDomRef.current;
    this.dragDom = this.layoutDom.querySelector('.drag-change-icon');
    this.lineDom = this.layoutDom.querySelector('.slider-content');
    this.layoutDom.addEventListener('mousemove', this.renderSliderTips, false);
    this.layoutDom.addEventListener('mouseout', this.hideSliderTips, false);
    this.lineDom.addEventListener('click', this.changeCurrentValue, false);
    this.dragDom.addEventListener('click', this.cancelPropagation, false);
    this.dragDom.addEventListener('mousedown', this.startDrag, false);
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
    this.layoutDom.removeEventListener('mousemove', this.renderSliderTips, false);
    this.layoutDom.removeEventListener('mouseout', this.hideSliderTips, false);
    this.lineDom.removeEventListener('click', this.changeCurrentValue, false);
    this.dragDom.removeEventListener('click', this.cancelPropagation, false);
    this.dragDom.removeEventListener('mousedown', this.startDrag, false);
    document.body.removeEventListener('mousemove', this.moveChange);
    document.body.removeEventListener('mouseup', this.stopDrag);
    this.sliderDomRef = null;
    this.layoutDom = null;
    this.lineDom = null;
    this.dragDom = null;
    this.dragFlag = null;
  }

  computedPositionForEvent(e) {
    const {
      x,
      width
    } = this.layoutDom.getBoundingClientRect();
    const {
      pageX
    } = e;
    let dx = pageX - x;

    if (dx > width) {
      dx = width;
    }

    if (dx < 0) {
      dx = 0;
    }

    return dx / width * 100;
  }

  render() {
    const {
      value,
      showTips,
      tipsX
    } = this.state;
    const {
      availablePercent = 0,
      className = '',
      tipsY
    } = this.props;
    return React.createElement("div", {
      className: `slider-layout ${className}`,
      ref: this.sliderDomRef
    }, React.createElement("div", {
      className: "slider-content"
    }, React.createElement("div", {
      className: "slider-max-line"
    }), React.createElement("div", {
      className: "slider-visibel-line",
      style: {
        width: `${availablePercent}%`
      }
    }), React.createElement("div", {
      className: "slider-current-line",
      style: {
        width: `${value}%`
      }
    }), this.props.children), React.createElement("div", {
      className: "slider-other-content"
    }, React.createElement("div", {
      className: "drag-change-icon",
      draggable: false,
      style: {
        left: `${value}%`
      }
    })), React.createElement(Tips, {
      visibel: showTips,
      className: "lm-player-slide-tips",
      style: {
        left: tipsX,
        top: tipsY
      },
      getContainer: () => this.sliderDomRef.current
    }, this.props.renderTips && this.props.renderTips(this.state.tempValue)));
  }

}

Slider.propTypes = {
  currentPercent: PropTypes.number,
  seekTo: PropTypes.func,
  video: PropTypes.element,
  renderTips: PropTypes.func,
  availablePercent: PropTypes.number,
  onChange: PropTypes.func,
  children: PropTypes.any,
  className: PropTypes.string,
  tipsY: PropTypes.number
};
Slider.defaultProps = {
  tipsY: -10
};

function Tips({
  getContainer,
  visibel,
  children,
  style,
  className = ''
}) {
  const ele = useRef(document.createElement('div'));
  useEffect(() => {
    const box = getContainer ? getContainer() || document.body : document.body;
    box.appendChild(ele.current);
    return () => box.removeChild(ele.current);
  }, [getContainer]);

  if (!visibel) {
    return null;
  }

  return ReactDOM.createPortal(React.createElement("div", {
    className: className,
    style: style
  }, children), ele.current);
}

Tips.propTypes = {
  visibel: PropTypes.bool,
  children: PropTypes.element,
  style: PropTypes.any,
  className: PropTypes.string
};

function Bar({
  visibel = true,
  className = '',
  children,
  ...props
}) {
  if (visibel === false) {
    return null;
  }

  return React.createElement("span", _extends({
    className: `contraller-bar-item ${className}`
  }, props), children);
}
Bar.propTypes = {
  visibel: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.any
};

var EventName = {
  RELOAD: "reload",
  //手动视频重载
  RELOAD_FAIL: "reloadFail",
  // 视频出错，重连失败
  RELOAD_SUCCESS: "reloadSuccess",
  //视频出错，重连成功
  ERROR: "error",
  //视频出错
  ERROR_RELOAD: "errorRload",
  //视频出错，自动重连
  HISTORY_PLAY_END: "historyPlayEnd",
  //历史视频列表播放结束
  SEEK: "seek",
  //跳跃播放时间
  TRANSFORM: "transform",
  //视频容器缩放
  CHANGE_PLAY_INDEX: "changePlayIndex",
  //历史视频列表播放索引改变
  HIDE_CONTRALLER: "hideContraller",
  SHOW_CONTRALLER: "showContraller",
  CLEAR_ERROR_TIMER: "clearErrorTimer"
};

function LeftBar({
  api,
  event,
  video,
  isHistory,
  reloadHistory,
  isLive,
  leftExtContents,
  leftMidExtContents
}) {
  const [openSliderVolume, setOpenSliderVolume] = useState(false);
  const [dep, setDep] = useState(Date.now());
  useEffect(() => {
    const updateRender = () => {
      setDep(Date.now());
    };

    event.addEventListener('play', updateRender);
    event.addEventListener('pause', updateRender);
    event.addEventListener('volumechange', updateRender);
    return () => {
      event.removeEventListener('play', updateRender);
      event.removeEventListener('pause', updateRender);
      event.removeEventListener('volumechange', updateRender);
    };
  }, [event]); //缓存值

  const paused = useMemo(() => video.paused, [dep, video]);
  const statusIconClassName = useMemo(() => paused ? 'lm-player-Play_Main' : 'lm-player-Pause_Main', [paused]);
  const statusText = useMemo(() => paused ? '播放' : '暂停', [paused]);
  const volumeVal = useMemo(() => video.muted ? 0 : video.volume, [dep, video]);
  const volumeIcon = useMemo(() => volumeVal === 0 ? 'lm-player-volume-close' : video.volume === 1 ? 'lm-player-volume-max' : 'lm-player-volume-normal-fuben', [volumeVal]);
  const volumePercent = useMemo(() => volumeVal === 0 ? 0 : volumeVal * 100, [volumeVal]);
  const sliderClassName = useMemo(() => openSliderVolume ? 'contraller-bar-hover-volume' : '', [openSliderVolume]); //TODO 方法

  const changePlayStatus = useCallback(() => video.paused ? api.play() : api.pause(), [video, api]);
  const mutedChantgeStatus = useCallback(() => video.muted ? api.unmute() : api.mute(), [api, video]);
  const onChangeVolume = useCallback(volume => {
    api.setVolume(parseFloat(volume.toFixed(1)));
    volume > 0 && video.muted && api.unmute();
  }, [api, video]);
  const reload = useCallback(() => {
    isHistory ? reloadHistory() : api.reload();
    event.emit(EventName.CLEAR_ERROR_TIMER);
  }, [event, isHistory, api]);
  return React.createElement("div", {
    className: "contraller-left-bar"
  }, leftExtContents, React.createElement(Bar, {
    visibel: !isLive
  }, React.createElement(IconFont, {
    onClick: changePlayStatus,
    type: statusIconClassName,
    title: statusText
  })), React.createElement(Bar, {
    className: `contraller-bar-volume ${sliderClassName}`,
    onMouseOver: () => setOpenSliderVolume(true),
    onMouseOut: () => setOpenSliderVolume(false)
  }, React.createElement(IconFont, {
    onClick: mutedChantgeStatus,
    type: volumeIcon,
    title: "\u97F3\u91CF"
  }), React.createElement("div", {
    className: "volume-slider-layout"
  }, React.createElement(Slider, {
    className: "volume-slider",
    currentPercent: volumePercent,
    onChange: onChangeVolume,
    renderTips: precent => React.createElement("span", null, Math.round(precent * 100), "%"),
    tipsY: -2
  }))), React.createElement(Bar, null, React.createElement(IconFont, {
    onClick: reload,
    type: "lm-player-Refresh_Main",
    title: "\u91CD\u8F7D"
  })), leftMidExtContents);
}

LeftBar.propTypes = {
  api: PropTypes.object,
  event: PropTypes.object,
  playerProps: PropTypes.object,
  video: PropTypes.node,
  reloadHistory: PropTypes.func,
  isHistory: PropTypes.bool
};

function RightBar({
  playContainer,
  api,
  scale,
  snapshot,
  rightExtContents,
  rightMidExtContents
}) {
  const [dep, setDep] = useState(Date.now());
  useEffect(() => {
    const update = () => setDep(Date.now());

    fullScreenListener(true, update);
    return () => fullScreenListener(false, update);
  }, []);
  const isfull = useMemo(() => isFullscreen(playContainer), [dep, playContainer]);
  const fullscreen = useCallback(() => {
    !isFullscreen(playContainer) ? api.requestFullScreen() : api.cancelFullScreen();
    setDep(Date.now());
  }, [api, playContainer]);
  const setScale = useCallback((...args) => {
    const dragDom = playContainer.querySelector('.player-mask-layout');
    api.setScale(...args);
    let position = computedBound(dragDom, api.getPosition(), api.getScale());
    position && api.setPosition(position, true);
  }, [api, playContainer]);
  return React.createElement("div", {
    className: "contraller-right-bar"
  }, rightMidExtContents, scale && React.createElement(React.Fragment, null, React.createElement(Bar, null, React.createElement(IconFont, {
    title: "\u7F29\u5C0F",
    onClick: () => setScale(-0.2),
    type: 'lm-player-ZoomOut_Main'
  })), React.createElement(Bar, null, React.createElement(IconFont, {
    title: "\u590D\u4F4D",
    onClick: () => setScale(1, true),
    type: 'lm-player-ZoomDefault_Main'
  })), React.createElement(Bar, null, React.createElement(IconFont, {
    title: "\u653E\u5927",
    onClick: () => setScale(0.2),
    type: 'lm-player-ZoomIn_Main'
  }))), snapshot && React.createElement(Bar, null, React.createElement(IconFont, {
    title: "\u622A\u56FE",
    onClick: () => snapshot(api.snapshot()),
    type: "lm-player-SearchBox"
  })), React.createElement(Bar, null, React.createElement(IconFont, {
    title: isfull ? '窗口' : '全屏',
    onClick: fullscreen,
    type: isfull ? 'lm-player-ExitFull_Main' : 'lm-player-Full_Main'
  })), rightExtContents);
}

RightBar.propTypes = {
  api: PropTypes.object,
  event: PropTypes.object,
  playerProps: PropTypes.object,
  playContainer: PropTypes.node,
  reloadHistory: PropTypes.func,
  isHistory: PropTypes.bool
};

function ContrallerBar({
  playContainer,
  snapshot,
  rightExtContents,
  rightMidExtContents,
  scale,
  visibel,
  api,
  event,
  video,
  isHistory,
  reloadHistory,
  isLive,
  leftExtContents,
  leftMidExtContents
}) {
  return React.createElement("div", {
    className: `contraller-bar-layout ${!visibel ? 'hide-contraller-bar' : ''}`
  }, React.createElement(LeftBar, {
    api: api,
    event: event,
    video: video,
    isHistory: isHistory,
    reloadHistory: reloadHistory,
    isLive: isLive,
    leftMidExtContents: leftMidExtContents,
    leftExtContents: leftExtContents
  }), React.createElement(RightBar, {
    api: api,
    event: event,
    playContainer: playContainer,
    scale: scale,
    snapshot: snapshot,
    rightExtContents: rightExtContents,
    rightMidExtContents: rightMidExtContents
  }));
}

ContrallerBar.propTypes = {
  visibel: PropTypes.bool
};

function ContrallerEvent({
  event,
  playContainer,
  children
}) {
  const timer = useRef(null);
  const [visibel, setVisibel] = useState(true);
  useEffect(() => {
    const showContraller = () => {
      setVisibel(true);
      hideContraller();
      event.emit(EventName.SHOW_CONTRALLER);
    };

    const hideContraller = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setVisibel(false);
        event.emit(EventName.HIDE_CONTRALLER);
      }, 3 * 1000);
    };

    playContainer.addEventListener('mousemove', showContraller, false);
    playContainer.addEventListener('mouseout', hideContraller, false);
  });
  return React.Children.map(children, child => React.isValidElement(child) ? React.cloneElement(child, {
    visibel
  }) : child);
}

function VideoMessage({
  event,
  api
}) {
  const [state, setState] = useState({
    status: null,
    errorTimer: null,
    loading: false
  });
  const message = useMemo(() => {
    if (!state.status) {
      return '';
    }

    if (state.status === 'fail') {
      return '视频错误';
    }

    if (state.status === 'reload') {
      return `视频加载错误，正在进行重连第${state.errorTimer}重连`;
    }
  }, [state.errorTimer, state.status]);
  useEffect(() => {
    const openLoading = () => setState(old => ({ ...old,
      loading: true
    }));

    const closeLoading = () => setState(old => ({ ...old,
      loading: false
    }));

    const errorReload = timer => setState(() => ({
      status: 'reload',
      errorTimer: timer,
      loading: true
    }));

    const reloadFail = () => setState(old => ({ ...old,
      status: 'fail'
    }));

    const reloadSuccess = () => setState(old => ({ ...old,
      status: null
    }));

    const reload = () => setState(old => ({ ...old,
      status: 'reload'
    }));

    const playEnd = () => (setState(old => ({ ...old,
      status: null,
      loading: false
    })), api.pause());

    event.addEventListener('loadstart', openLoading);
    event.addEventListener('waiting', openLoading);
    event.addEventListener('seeking', openLoading);
    event.addEventListener('loadeddata', closeLoading);
    event.addEventListener('canplay', closeLoading);
    event.on(EventName.ERROR_RELOAD, errorReload);
    event.on(EventName.RELOAD_FAIL, reloadFail);
    event.on(EventName.RELOAD_SUCCESS, reloadSuccess);
    event.on(EventName.RELOAD, reload);
    event.on(EventName.HISTORY_PLAY_END, playEnd);
    event.on(EventName.CLEAR_ERROR_TIMER, reloadSuccess);
    return () => {
      event.removeEventListener('loadstart', openLoading);
      event.removeEventListener('waiting', openLoading);
      event.removeEventListener('seeking', openLoading);
      event.removeEventListener('loadeddata', closeLoading);
      event.removeEventListener('canplay', closeLoading);
      event.off(EventName.ERROR_RELOAD, errorReload);
      event.off(EventName.RELOAD_FAIL, reloadFail);
      event.off(EventName.RELOAD_SUCCESS, reloadSuccess);
      event.off(EventName.RELOAD, reload);
      event.off(EventName.HISTORY_PLAY_END, playEnd);
      event.off(EventName.CLEAR_ERROR_TIMER, reloadSuccess);
    };
  }, [event]);
  const {
    loading,
    status
  } = state;
  return React.createElement("div", {
    className: `lm-player-message-mask ${loading || status === 'fail' ? 'lm-player-mask-loading-animation' : ''}`
  }, React.createElement(IconFont, {
    type: status === 'fail' ? 'lm-player-YesorNo_No_Dark' : 'lm-player-Loading',
    className: `${loading && status !== 'fail' ? 'lm-player-loading-animation' : status === 'fail' ? 'lm-player-loadfail' : ''} lm-player-loading-icon`
  }), React.createElement("span", {
    className: "lm-player-message"
  }, message));
}

const NoSource = () => {
  return React.createElement("div", {
    className: "lm-player-message-mask lm-player-mask-loading-animation"
  }, React.createElement(IconFont, {
    style: {
      fontSize: 80
    },
    type: "lm-player-PlaySource",
    title: "\u8BF7\u9009\u62E9\u89C6\u9891\u6E90"
  }));
};

function TineLine({
  event,
  api,
  visibel
}) {
  const [state, setState] = useState({
    duration: 0,
    currentTime: 0,
    buffered: 0
  });
  useEffect(() => {
    const getDuration = () => setState(old => ({ ...old,
      duration: api.getDuration()
    }));

    const getCurrentTime = () => setState(old => ({ ...old,
      currentTime: api.getCurrentTime(),
      buffered: api.getSecondsLoaded()
    }));

    const getBuffered = () => setState(old => ({ ...old,
      buffered: api.getSecondsLoaded()
    }));

    const seekendPlay = () => api.play();

    event.addEventListener('loadedmetadata', getDuration);
    event.addEventListener('durationchange', getDuration);
    event.addEventListener('timeupdate', getCurrentTime);
    event.addEventListener('progress', getBuffered);
    event.addEventListener('suspend', getBuffered);
    event.addEventListener('seeked', seekendPlay);
    return () => {
      event.removeEventListener('loadedmetadata', getDuration);
      event.removeEventListener('durationchange', getDuration);
      event.removeEventListener('timeupdate', getCurrentTime);
      event.removeEventListener('progress', getBuffered);
      event.removeEventListener('suspend', getBuffered);
      event.removeEventListener('seeked', seekendPlay);
    };
  }, [event, api]);
  const {
    duration,
    currentTime,
    buffered
  } = state;
  const playPercent = useMemo(() => Math.round(currentTime / duration * 100), [currentTime, duration]);
  const bufferedPercent = useMemo(() => Math.round(buffered / duration * 100), [buffered, duration]);
  const changePlayTime = useCallback(percent => {
    const currentTime = percent * duration;
    api.pause();
    api.seekTo(currentTime);
    setState(old => ({ ...old,
      currentTime
    }));
  }, [duration, api]);

  const renderTimeLineTips = percent => {
    const currentTime = percent * duration;
    const time = timeStamp(currentTime);
    return React.createElement("span", null, time);
  };

  return React.createElement("div", {
    className: `video-time-line-layout ${!visibel ? 'hide-time-line' : ''}`
  }, React.createElement(IconFont, {
    type: "lm-player-PrevFast",
    onClick: api.backWind,
    className: "time-line-action-item"
  }), React.createElement(Slider, {
    className: "time-line-box",
    currentPercent: playPercent,
    availablePercent: bufferedPercent,
    onChange: changePlayTime,
    renderTips: renderTimeLineTips
  }), React.createElement(IconFont, {
    type: "lm-player-NextFast_Light",
    onClick: api.fastForward,
    className: "time-line-action-item"
  }));
}

function ErrorEvent({
  event,
  api,
  errorReloadTimer,
  flv,
  hls,
  changePlayIndex,
  isHistory,
  playIndex
}) {
  const [errorTimer, setErrorTime] = useState(0);
  const errorInfo = useRef(null);
  const reloadTimer = useRef(null);
  useEffect(() => {
    const errorHandle = (...args) => {
      console.error(...args);
      errorInfo.current = args;
      setErrorTime(errorTimer + 1);
    };

    const reloadSuccess = () => {
      if (errorTimer > 0) {
        console.warn('视频重连成功！');
        event.emit(EventName.RELOAD_SUCCESS);
        clearErrorTimer();
      }
    };

    const clearErrorTimer = () => setErrorTime(0);

    if (flv) {
      flv.on('error', errorHandle);
    }

    if (hls) {
      hls.on('hlsError', errorHandle);
    }

    if (isHistory) {
      //历史视频切换播放索引时清除错误次数
      event.on(EventName.CHANGE_PLAY_INDEX, clearErrorTimer); //历史视频主动清除错误次数

      event.on(EventName.CLEAR_ERROR_TIMER, clearErrorTimer);
    }

    event.addEventListener('error', errorHandle, false); //获取video状态清除错误状态

    event.addEventListener('canplay', reloadSuccess, false);
    return () => {
      if (flv) {
        flv.off('error', errorHandle);
      }

      if (hls) {
        hls.off('hlsError', errorHandle);
      }

      if (isHistory) {
        event.off(EventName.CHANGE_PLAY_INDEX, clearErrorTimer);
        event.off(EventName.CLEAR_ERROR_TIMER, clearErrorTimer);
      }

      event.removeEventListener('error', errorHandle, false);
      event.removeEventListener('canplay', reloadSuccess, false);
    };
  }, [event, flv, hls, errorTimer]);
  useEffect(() => {
    if (errorTimer === 0) {
      return;
    }

    if (errorTimer > errorReloadTimer) {
      return isHistory ? changePlayIndex(playIndex + 1) : event.emit(EventName.RELOAD_FAIL), api.unload();
    }

    console.warn(`视频播放出错，正在进行重连${errorTimer}`);
    reloadTimer.current = setTimeout(() => {
      event.emit(EventName.ERROR_RELOAD, errorTimer, ...errorInfo.current);
      api.reload(true);
    }, 2 * 1000);
    return () => {
      clearTimeout(reloadTimer.current);
    };
  }, [errorTimer, api, event, flv, hls]);
  return React.createElement(React.Fragment, null);
}

class DragEvent extends React.Component {
  constructor(props) {
    super(props);

    this.openDrag = e => {
      this.position.start = [e.pageX, e.pageY];
      this.dragDom.addEventListener('mousemove', this.moveChange);
      this.dragDom.addEventListener('mouseup', this.stopDrag);
    };

    this.moveChange = e => {
      const {
        api
      } = this.props;
      const currentPosition = api.getPosition();
      this.position.end = [e.pageX, e.pageY];
      const x = currentPosition[0] + (this.position.end[0] - this.position.start[0]);
      const y = currentPosition[1] + (this.position.end[1] - this.position.start[1]);
      const position = [x, y];
      api.setPosition(position);
      this.position.start = [e.pageX, e.pageY];
    };

    this.stopDrag = () => {
      this.dragDom.removeEventListener('mousemove', this.moveChange);
      this.dragDom.removeEventListener('mouseup', this.stopDrag);
      this.transformChange();
    };

    this.transformChange = () => {
      const {
        api
      } = this.props;
      let position = computedBound(this.dragDom, api.getPosition(), api.getScale());
      position && api.setPosition(position, true);
    };

    const {
      playContainer
    } = props;
    this.dragDom = playContainer.querySelector('.player-mask-layout');
    this.position = {
      start: [0, 0],
      end: [0, 0]
    };
  }

  componentDidMount() {
    this.dragDom.addEventListener('mousedown', this.openDrag);
    this.props.event.addEventListener('transform', this.transformChange, true);
  }

  componentWillUnmount() {
    this.dragDom.removeEventListener('mousedown', this.openDrag);
  }

  render() {
    return null;
  }

}

DragEvent.propTypes = {
  api: PropTypes.object,
  event: PropTypes.object,
  playContainer: PropTypes.node,
  playerProps: PropTypes.object
};

class Api {
  constructor({
    video,
    playContainer,
    event,
    flv,
    hls
  }) {
    this.player = video;
    this.playContainer = playContainer;
    this.flv = flv;
    this.hls = hls;
    this.event = event;
    this.scale = 1;
    this.position = [0, 0];
  }
  /**
   * 播放器销毁后 动态跟新api下的flv，hls对象
   * @param {*} param0
   */


  updateChunk({
    flv,
    hls
  }) {
    this.flv = flv;
    this.hls = hls;
  }
  /**
   * 全屏
   */


  requestFullScreen() {
    if (!isFullscreen(this.playContainer)) {
      fullscreen(this.playContainer);
    }
  }
  /**
   * 退出全屏
   */


  cancelFullScreen() {
    if (isFullscreen(this.playContainer)) {
      exitFullscreen();
    }
  }

  play() {
    if (this.player.paused) {
      this.player.play();
    }
  }

  pause() {
    if (!this.player.paused) {
      this.player.pause();
    }
  }

  destroy() {
    this.player.removeAttribute('src');
    this.unload();

    if (this.flv) {
      this.flv.destroy();
    }

    if (this.hls) {
      this.hls.destroy();
    }
  }
  /**
   * 设置currentTime实现seek
   * @param {*} seconds
   * @param {*} noEmit
   */


  seekTo(seconds, noEmit) {
    const buffered = this.getBufferedTime();

    if (this.flv && buffered[0] > seconds) {
      this.flv.unload();
      this.flv.load();
    }

    this.player.currentTime = seconds;

    if (!noEmit) {
      this.event.emit(EventName.SEEK, seconds);
    }
  }
  /**
   * 视频重载
   */


  reload(notEmit) {
    if (this.getCurrentTime !== 0) {
      this.seekTo(0);
    }

    if (this.hls) {
      this.hls.swapAudioCodec();
      this.hls.recoverMediaError();
    }

    this.unload();
    this.load();
    !notEmit && this.event.emit(EventName.RELOAD);
  }

  unload() {
    this.flv && this.flv.unload();
    this.hls && this.hls.stopLoad();
  }

  load() {
    if (this.flv) {
      this.flv.load();
    }

    if (this.hls) {
      this.hls.startLoad();
      this.hls.loadSource(this.hls.url);
    }
  }

  setVolume(fraction) {
    this.player.volume = fraction;
  }

  mute() {
    this.player.muted = true;
  }

  unmute() {
    this.player.muted = false;
  }
  /**
   * 开启画中画功能
   */


  requestPictureInPicture() {
    if (this.player.requestPictureInPicture && document.pictureInPictureElement !== this.player) {
      this.player.requestPictureInPicture();
    }
  }
  /**
   * 关闭画中画功能
   */


  exitPictureInPicture() {
    if (document.exitPictureInPicture && document.pictureInPictureElement === this.player) {
      document.exitPictureInPicture();
    }
  }
  /**
   * 设置播放速率
   * @param {*} rate
   */


  setPlaybackRate(rate) {
    this.player.playbackRate = rate;
  }
  /**
   * 获取视频总时长
   */


  getDuration() {
    if (!this.player) return null;
    const {
      duration,
      seekable
    } = this.player;

    if (duration === Infinity && seekable.length > 0) {
      return seekable.end(seekable.length - 1);
    }

    return duration;
  }
  /**
   * 获取当前播放时间
   */


  getCurrentTime() {
    if (!this.player) return null;
    return this.player.currentTime;
  }
  /**
   * 获取缓存时间
   */


  getSecondsLoaded() {
    return this.getBufferedTime()[1];
  }
  /**
   * 获取当前视频缓存的起止时间
   */


  getBufferedTime() {
    if (!this.player) return null;
    const {
      buffered
    } = this.player;

    if (buffered.length === 0) {
      return [0, 0];
    }

    const end = buffered.end(buffered.length - 1);
    const start = buffered.start(buffered.length - 1);
    const duration = this.getDuration();

    if (end > duration) {
      return duration;
    }

    return [start, end];
  }
  /**
   * 快进通过seekTo方法实现
   * @param {*} second
   */


  fastForward(second = 5) {
    const duration = this.getDuration();
    const currentTime = this.getCurrentTime();
    const time = currentTime + second;
    this.seekTo(time > duration - 1 ? duration - 1 : time);
  }
  /**
   * 快退通过seekTo方法实现
   * @param {*} second
   */


  backWind(second = 5) {
    const currentTime = this.getCurrentTime();
    const time = currentTime - second;
    this.seekTo(time < 1 ? 1 : time);
  }
  /**
   * 视频截屏方法
   */


  snapshot() {
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    canvas.width = this.player.videoWidth;
    canvas.height = this.player.videoHeight;
    ctx.drawImage(this.player, 0, 0, canvas.width, canvas.height);
    setTimeout(() => {
      canvas.remove();
      canvas = null;
      ctx = null;
    }, 200);
    return canvas.toDataURL();
  }

  setScale(num, isRest = false) {
    let scale = this.scale + num;

    if (isRest) {
      scale = num;
    } else {
      if (scale < 1) {
        scale = 1;
      }

      if (scale > 3) {
        scale = 3;
      }
    }

    this.scale = scale;
    this.player.style.transition = 'transform 0.3s';

    this.__setTransform();

    this.event.emit(EventName.TRANSFORM);
    setTimeout(() => {
      this.player.style.transition = 'unset';
    }, 500);
  }

  getScale() {
    return this.scale;
  }

  setPosition(position, isAnimate) {
    this.position = position;
    this.player.style.transition = isAnimate ? 'transform 0.3s' : 'unset';

    this.__setTransform();
  }

  getPosition() {
    return this.position;
  }

  __setTransform() {
    this.player.style.transform = `scale(${this.scale}) translate(${this.position[0]}px,${this.position[1]}px)`;
  }

  getApi() {
    return {
      play: this.play.bind(this),
      reload: this.reload.bind(this),
      pause: this.pause.bind(this),
      seekTo: this.seekTo.bind(this),
      setVolume: this.setVolume.bind(this),
      mute: this.mute.bind(this),
      unmute: this.unmute.bind(this),
      requestPictureInPicture: this.requestPictureInPicture.bind(this),
      exitPictureInPicture: this.exitPictureInPicture.bind(this),
      setPlaybackRate: this.setPlaybackRate.bind(this),
      destroy: this.destroy.bind(this),
      getDuration: this.getDuration.bind(this),
      getCurrentTime: this.getCurrentTime.bind(this),
      getSecondsLoaded: this.getSecondsLoaded.bind(this),
      getBufferedTime: this.getBufferedTime.bind(this),
      fastForward: this.fastForward.bind(this),
      backWind: this.backWind.bind(this),
      snapshot: this.snapshot.bind(this),
      requestFullScreen: this.requestFullScreen.bind(this),
      cancelFullScreen: this.cancelFullScreen.bind(this),
      __player: this.player,
      flv: this.flv,
      hls: this.hls
    };
  }

}

function getHiddenProp() {
  const prefixes = ["webkit", "moz", "ms", "o"]; // 如果hidden 属性是原生支持的，我们就直接返回

  if ("hidden" in document) {
    return "hidden";
  } // 其他的情况就循环现有的浏览器前缀，拼接我们所需要的属性


  for (let i = 0; i < prefixes.length; i++) {
    // 如果当前的拼接的前缀在 document对象中存在 返回即可
    if (prefixes[i] + "Hidden" in document) {
      return prefixes[i] + "Hidden";
    }
  } // 其他的情况 直接返回null


  return null;
}

function getVisibilityState() {
  const prefixes = ["webkit", "moz", "ms", "o"];

  if ("visibilityState" in document) {
    return "visibilityState";
  }

  for (let i = 0; i < prefixes.length; i++) {
    if (prefixes[i] + "VisibilityState" in document) {
      return prefixes[i] + "VisibilityState";
    }
  } // 找不到返回 null


  return null;
}

function visibilityState() {
  return document[getVisibilityState()];
}

function addEventListener(listener) {
  const visProp = getHiddenProp();
  const evtname = visProp.replace(/[H|h]idden/, "") + "visibilitychange";
  document.addEventListener(evtname, listener, false);
}

function removeEventListener(listener) {
  const visProp = getHiddenProp();
  const evtname = visProp.replace(/[H|h]idden/, "") + "visibilitychange";
  document.removeEventListener(evtname, listener, false);
}

var BrowserTab = {
  addEventListener,
  removeEventListener,
  visibilityState
};

function LiveHeart({
  api
}) {
  useEffect(() => {
    const browserTabChange = function () {
      if (BrowserTab.visibilityState() === 'visible') {
        const current = api.getCurrentTime();
        const buffered = api.getSecondsLoaded();

        if (buffered - current > 5) {
          console.warn(`当前延时过大current->${current} buffered->${buffered}, 基于视频当前缓存时间更新当前播放时间 updateTime -> ${buffered - 2}`);
          api.seekTo(buffered - 2 > 0 ? buffered - 2 : 0);
        }
      }
    };

    BrowserTab.addEventListener(browserTabChange);
    return () => {
      BrowserTab.removeEventListener(browserTabChange);
    };
  }, [api]);
  return React.createElement(React.Fragment, null);
}

//Decoder states.
const decoderStateIdle = 0;
const decoderStateInitializing = 1;
const decoderStateReady = 2;
const decoderStateFinished = 3; //Player states.

const playerStateIdle = 0;
const playerStatePlaying = 1;
const playerStatePausing = 2; //Constant.

const maxBufferTimeLength = 1.0;
const downloadSpeedByteRateCoef = 2.0;

const kGetFileInfoReq = 0;
const kDownloadFileReq = 1;

const kGetFileInfoRsp = 0;
const kFileData = 1; //Downloader Protocol.

const kProtoHttp = 0;
const kProtoWebsocket = 1; //Decoder request.

const kInitDecoderReq = 0;
const kUninitDecoderReq = 1;
const kOpenDecoderReq = 2;
const kCloseDecoderReq = 3;
const kFeedDataReq = 4;
const kStartDecodingReq = 5;
const kPauseDecodingReq = 6;
const kSeekToReq = 7; //Decoder response.

const kInitDecoderRsp = 0;
const kOpenDecoderRsp = 2;
const kVideoFrame = 4;
const kAudioFrame = 5;
const kDecodeFinishedEvt = 8;
const kRequestDataEvt = 9;
const kSeekToRsp = 10;

function PCMPlayer(option) {
  this.init(option);
}

PCMPlayer.prototype.init = function (option) {
  var defaults = {
    encoding: '16bitInt',
    channels: 1,
    sampleRate: 8000,
    flushingTime: 1000
  };
  this.option = Object.assign({}, defaults, option);
  this.samples = new Float32Array();
  this.flush = this.flush.bind(this);
  this.interval = setInterval(this.flush, this.option.flushingTime);
  this.maxValue = this.getMaxValue();
  this.typedArray = this.getTypedArray();
  this.createContext();
};

PCMPlayer.prototype.getMaxValue = function () {
  var encodings = {
    '8bitInt': 128,
    '16bitInt': 32768,
    '32bitInt': 2147483648,
    '32bitFloat': 1
  };
  return encodings[this.option.encoding] ? encodings[this.option.encoding] : encodings['16bitInt'];
};

PCMPlayer.prototype.getTypedArray = function () {
  var typedArrays = {
    '8bitInt': Int8Array,
    '16bitInt': Int16Array,
    '32bitInt': Int32Array,
    '32bitFloat': Float32Array
  };
  return typedArrays[this.option.encoding] ? typedArrays[this.option.encoding] : typedArrays['16bitInt'];
};

PCMPlayer.prototype.createContext = function () {
  this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  this.gainNode = this.audioCtx.createGain();
  this.gainNode.gain.value = 1;
  this.gainNode.connect(this.audioCtx.destination);
  this.startTime = this.audioCtx.currentTime;
};

PCMPlayer.prototype.isTypedArray = function (data) {
  return data.byteLength && data.buffer && data.buffer.constructor == ArrayBuffer;
};

PCMPlayer.prototype.feed = function (data) {
  if (!this.isTypedArray(data)) return;
  data = this.getFormatedValue(data);
  var tmp = new Float32Array(this.samples.length + data.length);
  tmp.set(this.samples, 0);
  tmp.set(data, this.samples.length);
  this.samples = tmp;
};

PCMPlayer.prototype.getFormatedValue = function (data) {
  var data = new this.typedArray(data.buffer),
      float32 = new Float32Array(data.length),
      i;

  for (i = 0; i < data.length; i++) {
    float32[i] = data[i] / this.maxValue;
  }

  return float32;
};

PCMPlayer.prototype.volume = function (volume) {
  this.gainNode.gain.value = volume;
};

PCMPlayer.prototype.destroy = function () {
  if (this.interval) {
    clearInterval(this.interval);
  }

  this.samples = null;
  this.audioCtx.close();
  this.audioCtx = null;
};

PCMPlayer.prototype.flush = function () {
  if (!this.samples.length) return;
  var bufferSource = this.audioCtx.createBufferSource(),
      length = this.samples.length / this.option.channels,
      audioBuffer = this.audioCtx.createBuffer(this.option.channels, length, this.option.sampleRate),
      audioData,
      channel,
      offset,
      i,
      decrement;

  for (channel = 0; channel < this.option.channels; channel++) {
    audioData = audioBuffer.getChannelData(channel);
    offset = channel;
    decrement = 50;

    for (i = 0; i < length; i++) {
      audioData[i] = this.samples[offset];
      /* fadein */

      if (i < 50) {
        audioData[i] = audioData[i] * i / 50;
      }
      /* fadeout*/


      if (i >= length - 51) {
        audioData[i] = audioData[i] * decrement-- / 50;
      }

      offset += this.option.channels;
    }
  }

  if (this.startTime < this.audioCtx.currentTime) {
    this.startTime = this.audioCtx.currentTime;
  } //console.log('start vs current '+this.startTime+' vs '+this.audioCtx.currentTime+' duration: '+audioBuffer.duration);


  bufferSource.buffer = audioBuffer;
  bufferSource.connect(this.gainNode);
  bufferSource.start(this.startTime);
  this.startTime += audioBuffer.duration;
  this.samples = new Float32Array();
};

PCMPlayer.prototype.getTimestamp = function () {
  if (this.audioCtx) {
    return this.audioCtx.currentTime;
  } else {
    return 0;
  }
};

PCMPlayer.prototype.play = function (data) {
  if (!this.isTypedArray(data)) {
    return;
  }

  data = this.getFormatedValue(data);

  if (!data.length) {
    return;
  }

  var bufferSource = this.audioCtx.createBufferSource(),
      length = data.length / this.option.channels,
      audioBuffer = this.audioCtx.createBuffer(this.option.channels, length, this.option.sampleRate),
      audioData,
      channel,
      offset,
      i,
      decrement;

  for (channel = 0; channel < this.option.channels; channel++) {
    audioData = audioBuffer.getChannelData(channel);
    offset = channel;
    decrement = 50;

    for (i = 0; i < length; i++) {
      audioData[i] = data[offset];
      /* fadein */

      if (i < 50) {
        audioData[i] = audioData[i] * i / 50;
      }
      /* fadeout*/


      if (i >= length - 51) {
        audioData[i] = audioData[i] * decrement-- / 50;
      }

      offset += this.option.channels;
    }
  }

  if (this.startTime < this.audioCtx.currentTime) {
    this.startTime = this.audioCtx.currentTime;
  } //console.log('start vs current '+this.startTime+' vs '+this.audioCtx.currentTime+' duration: '+audioBuffer.duration);


  bufferSource.buffer = audioBuffer;
  bufferSource.connect(this.gainNode);
  bufferSource.start(this.startTime);
  this.startTime += audioBuffer.duration;
};

PCMPlayer.prototype.pause = function () {
  if (this.audioCtx.state === 'running') {
    this.audioCtx.suspend();
  }
};

PCMPlayer.prototype.resume = function () {
  if (this.audioCtx.state === 'suspended') {
    this.audioCtx.resume();
  }
};

function Texture(gl) {
  this.gl = gl;
  this.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

Texture.prototype.bind = function (n, program, name) {
  var gl = this.gl;
  gl.activeTexture([gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2][n]);
  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  gl.uniform1i(gl.getUniformLocation(program, name), n);
};

Texture.prototype.fill = function (width, height, data) {
  var gl = this.gl;
  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
};

function WebGLPlayer(canvas, options) {
  this.canvas = canvas;
  this.gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  this.initGL(options);
}

WebGLPlayer.prototype.initGL = function (options) {
  if (!this.gl) {
    console.log("[ER] WebGL not supported.");
    return;
  }

  var gl = this.gl;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  var program = gl.createProgram();
  var vertexShaderSource = ["attribute highp vec4 aVertexPosition;", "attribute vec2 aTextureCoord;", "varying highp vec2 vTextureCoord;", "void main(void) {", " gl_Position = aVertexPosition;", " vTextureCoord = aTextureCoord;", "}"].join("\n");
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);
  var fragmentShaderSource = ["precision highp float;", "varying lowp vec2 vTextureCoord;", "uniform sampler2D YTexture;", "uniform sampler2D UTexture;", "uniform sampler2D VTexture;", "const mat4 YUV2RGB = mat4", "(", " 1.1643828125, 0, 1.59602734375, -.87078515625,", " 1.1643828125, -.39176171875, -.81296875, .52959375,", " 1.1643828125, 2.017234375, 0, -1.081390625,", " 0, 0, 0, 1", ");", "void main(void) {", " gl_FragColor = vec4( texture2D(YTexture, vTextureCoord).x, texture2D(UTexture, vTextureCoord).x, texture2D(VTexture, vTextureCoord).x, 1) * YUV2RGB;", "}"].join("\n");
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log("[ER] Shader link failed.");
  }

  var vertexPositionAttribute = gl.getAttribLocation(program, "aVertexPosition");
  gl.enableVertexAttribArray(vertexPositionAttribute);
  var textureCoordAttribute = gl.getAttribLocation(program, "aTextureCoord");
  gl.enableVertexAttribArray(textureCoordAttribute);
  var verticesBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0, -1.0, 0.0, -1.0, -1.0, 0.0]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
  var texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
  gl.y = new Texture(gl);
  gl.u = new Texture(gl);
  gl.v = new Texture(gl);
  gl.y.bind(0, program, "YTexture");
  gl.u.bind(1, program, "UTexture");
  gl.v.bind(2, program, "VTexture");
};

WebGLPlayer.prototype.renderFrame = function (videoFrame, width, height, uOffset, vOffset) {
  if (!this.gl) {
    console.log("[ER] Render frame failed due to WebGL not supported.");
    return;
  }

  var gl = this.gl;
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.y.fill(width, height, videoFrame.subarray(0, uOffset));
  gl.u.fill(width >> 1, height >> 1, videoFrame.subarray(uOffset, uOffset + vOffset));
  gl.v.fill(width >> 1, height >> 1, videoFrame.subarray(uOffset + vOffset, videoFrame.length));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

WebGLPlayer.prototype.fullscreen = function () {
  var canvas = this.canvas;

  if (canvas.RequestFullScreen) {
    canvas.RequestFullScreen();
  } else if (canvas.webkitRequestFullScreen) {
    canvas.webkitRequestFullScreen();
  } else if (canvas.mozRequestFullScreen) {
    canvas.mozRequestFullScreen();
  } else if (canvas.msRequestFullscreen) {
    canvas.msRequestFullscreen();
  } else {
    alert("This browser doesn't supporter fullscreen");
  }
};

WebGLPlayer.prototype.exitfullscreen = function () {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  } else {
    alert("Exit fullscreen doesn't work");
  }
};

String.prototype.startWith = function (str) {
  var reg = new RegExp("^" + str);
  return reg.test(this);
};

function FileInfo(url) {
  this.url = url;
  this.size = 0;
  this.offset = 0;
  this.chunkSize = 65536;
}

function Player(h265lib) {
  this.fileInfo = null;
  this.pcmPlayer = null;
  this.canvas = null;
  this.webglPlayer = null;
  this.callback = null;
  this.waitHeaderLength = 524288;
  this.duration = 0;
  this.pixFmt = 0;
  this.videoWidth = 0;
  this.videoHeight = 0;
  this.yLength = 0;
  this.uvLength = 0;
  this.beginTimeOffset = 0;
  this.decoderState = decoderStateIdle;
  this.playerState = playerStateIdle;
  this.decoding = false;
  this.decodeInterval = 5;
  this.videoRendererTimer = null;
  this.downloadTimer = null;
  this.chunkInterval = 200;
  this.downloadSeqNo = 0;
  this.downloading = false;
  this.downloadProto = kProtoHttp;
  this.timeLabel = null;
  this.timeTrack = null;
  this.trackTimer = null;
  this.trackTimerInterval = 500;
  this.displayDuration = "00:00:00";
  this.audioEncoding = "";
  this.audioChannels = 0;
  this.audioSampleRate = 0;
  this.seeking = false; // Flag to preventing multi seek from track.

  this.justSeeked = false; // Flag to preventing multi seek from ffmpeg.

  this.urgent = false;
  this.loadingDiv = null;
  this.buffering = false;
  this.frameBuffer = [];
  this.isStream = false;
  this.streamReceivedlen = 0;
  this.firstAudioFrame = true;
  this.fetchController = null;
  this.streamPauseParam = null;
  this.downloaderAddress = h265lib + '/downloader.js';
  this.decoderAddress = h265lib + '/decoder.js'; // this.logger             = new Logger("Player");

  this.initDownloadWorker();
  this.initDecodeWorker();
}

Player.prototype.initDownloadWorker = function () {
  var self = this;
  this.downloadWorker = new Worker(this.downloaderAddress);

  this.downloadWorker.onmessage = function (evt) {
    var objData = evt.data;

    switch (objData.t) {
      case kGetFileInfoRsp:
        self.onGetFileInfo(objData.i);
        break;

      case kFileData:
        self.onFileData(objData.d, objData.s, objData.e, objData.q);
        break;
    }
  };
};

Player.prototype.initDecodeWorker = function () {
  var self = this;
  this.decodeWorker = new Worker(this.decoderAddress);

  this.decodeWorker.onmessage = function (evt) {
    var objData = evt.data;

    switch (objData.t) {
      case kInitDecoderRsp:
        self.onInitDecoder(objData);
        break;

      case kOpenDecoderRsp:
        self.onOpenDecoder(objData);
        break;

      case kVideoFrame:
        self.onVideoFrame(objData);
        break;

      case kAudioFrame:
        self.onAudioFrame(objData);
        break;

      case kDecodeFinishedEvt:
        self.onDecodeFinished(objData);
        break;

      case kRequestDataEvt:
        self.onRequestData(objData.o);
        break;

      case kSeekToRsp:
        self.onSeekToRsp(objData.r);
        break;
    }
  };
};

Player.prototype.play = function (url, canvas, callback, waitHeaderLength, isStream) {
  //  this.logger.logInfo("Play " + url + ".");
  var ret = {
    e: 0,
    m: "Success"
  };

  do {
    if (this.playerState == playerStatePausing) {
      ret = this.resume();
      break;
    }

    if (this.playerState == playerStatePlaying) {
      break;
    }

    if (!url) {
      ret = {
        e: -1,
        m: "Invalid url"
      };

      break;
    }

    if (!canvas) {
      ret = {
        e: -2,
        m: "Canvas not set"
      };

      break;
    }

    if (!this.downloadWorker) {
      ret = {
        e: -3,
        m: "Downloader not initialized"
      };

      break;
    }

    if (!this.decodeWorker) {
      ret = {
        e: -4,
        m: "Decoder not initialized"
      };

      break;
    }

    if (url.startWith("ws://") || url.startWith("wss://")) {
      this.downloadProto = kProtoWebsocket;
    } else {
      this.downloadProto = kProtoHttp;
    }

    this.fileInfo = new FileInfo(url);
    this.canvas = canvas;
    this.callback = callback;
    this.waitHeaderLength = waitHeaderLength || this.waitHeaderLength;
    this.playerState = playerStatePlaying;
    this.isStream = isStream;
    this.startTrackTimer();
    this.displayLoop(); //var playCanvasContext = playCanvas.getContext("2d"); //If get 2d, webgl will be disabled.

    this.webglPlayer = new WebGLPlayer(this.canvas, {
      preserveDrawingBuffer: false
    });

    if (!this.isStream) {
      var req = {
        t: kGetFileInfoReq,
        u: url,
        p: this.downloadProto
      };
      this.downloadWorker.postMessage(req);
    } else {
      this.requestStream(url);
      this.onGetFileInfo({
        sz: -1,
        st: 200
      });
    }

    var self = this;
    this.registerVisibilityEvent(function (visible) {
      if (visible) {
        self.resume();
      } else {
        self.pause();
      }
    });
    this.buffering = true;
    this.showLoading();
  } while (false);

  return ret;
};

Player.prototype.pauseStream = function () {
  if (this.playerState != playerStatePlaying) {
    var ret = {
      e: -1,
      m: "Not playing"
    };
    return ret;
  }

  this.streamPauseParam = {
    url: this.fileInfo.url,
    canvas: this.canvas,
    callback: this.callback,
    waitHeaderLength: this.waitHeaderLength
  }; // this.logger.logInfo("Stop in stream pause.");

  this.stop();
  var ret = {
    e: 0,
    m: "Success"
  };
  return ret;
};

Player.prototype.pause = function () {
  if (this.isStream) {
    return this.pauseStream();
  } // this.logger.logInfo("Pause.");


  if (this.playerState != playerStatePlaying) {
    var ret = {
      e: -1,
      m: "Not playing"
    };
    return ret;
  } //Pause video rendering and audio flushing.


  this.playerState = playerStatePausing; //Pause audio context.

  if (this.pcmPlayer) {
    this.pcmPlayer.pause();
  } //Pause decoding.


  this.pauseDecoding(); //Stop track timer.

  this.stopTrackTimer(); //Do not stop downloader for background buffering.

  var ret = {
    e: 0,
    m: "Success"
  };
  return ret;
};

Player.prototype.resumeStream = function () {
  if (this.playerState != playerStateIdle || !this.streamPauseParam) {
    var ret = {
      e: -1,
      m: "Not pausing"
    };
    return ret;
  } // this.logger.logInfo("Play in stream resume.");


  this.play(this.streamPauseParam.url, this.streamPauseParam.canvas, this.streamPauseParam.callback, this.streamPauseParam.waitHeaderLength, true);
  this.streamPauseParam = null;
  var ret = {
    e: 0,
    m: "Success"
  };
  return ret;
};

Player.prototype.resume = function (fromSeek) {
  if (this.isStream) {
    return this.resumeStream();
  } // this.logger.logInfo("Resume.");


  if (this.playerState != playerStatePausing) {
    var ret = {
      e: -1,
      m: "Not pausing"
    };
    return ret;
  }

  if (!fromSeek) {
    //Resume audio context.
    this.pcmPlayer.resume();
  } //If there's a flying video renderer op, interrupt it.


  if (this.videoRendererTimer != null) {
    clearTimeout(this.videoRendererTimer);
    this.videoRendererTimer = null;
  } //Restart video rendering and audio flushing.


  this.playerState = playerStatePlaying; //Restart decoding.

  this.startDecoding(); //Restart track timer.

  if (!this.seeking) {
    this.startTrackTimer();
  }

  var ret = {
    e: 0,
    m: "Success"
  };
  return ret;
};

Player.prototype.stop = function () {
  //    this.logger.logInfo("Stop.");
  if (this.playerState == playerStateIdle) {
    var ret = {
      e: -1,
      m: "Not playing"
    };
    return ret;
  }

  if (this.videoRendererTimer != null) {
    clearTimeout(this.videoRendererTimer);
    this.videoRendererTimer = null; //   this.logger.logInfo("Video renderer timer stopped.");
  }

  this.stopDownloadTimer();
  this.stopTrackTimer();
  this.fileInfo = null;
  this.canvas = null;
  this.webglPlayer = null;
  this.callback = null;
  this.duration = 0;
  this.pixFmt = 0;
  this.videoWidth = 0;
  this.videoHeight = 0;
  this.yLength = 0;
  this.uvLength = 0;
  this.beginTimeOffset = 0;
  this.decoderState = decoderStateIdle;
  this.playerState = playerStateIdle;
  this.decoding = false;
  this.frameBuffer = [];
  this.buffering = false;
  this.streamReceivedlen = 0;
  this.firstAudioFrame = true;

  if (this.pcmPlayer) {
    this.pcmPlayer.destroy();
    this.pcmPlayer = null; //      this.logger.logInfo("Pcm player released.");
  }

  if (this.timeTrack) {
    this.timeTrack.value = 0;
  } //   this.logger.logInfo("Closing decoder.");


  this.decodeWorker.postMessage({
    t: kCloseDecoderReq
  }); //  this.logger.logInfo("Uniniting decoder.");

  this.decodeWorker.postMessage({
    t: kUninitDecoderReq
  });

  if (this.fetchController) {
    this.fetchController.abort();
    this.fetchController = null;
  }

  return ret;
};

Player.prototype.seekTo = function (ms) {
  if (this.isStream) {
    return;
  } // Pause playing.


  this.pause(); // Stop download.

  this.stopDownloadTimer(); // Clear frame buffer.

  this.frameBuffer.length = 0; // Request decoder to seek.

  this.decodeWorker.postMessage({
    t: kSeekToReq,
    ms: ms
  }); // Reset begin time offset.

  this.beginTimeOffset = ms / 1000; //  this.logger.logInfo("seekTo beginTimeOffset " + this.beginTimeOffset);

  this.seeking = true;
  this.justSeeked = true;
  this.startBuffering();
};

Player.prototype.fullscreen = function () {
  if (this.webglPlayer) {
    this.webglPlayer.fullscreen();
  }
};

Player.prototype.getState = function () {
  return this.playerState;
};

Player.prototype.setTrack = function (timeTrack, timeLabel) {
  this.timeTrack = timeTrack;
  this.timeLabel = timeLabel;

  if (this.timeTrack) {
    var self = this;

    this.timeTrack.oninput = function () {
      if (!self.seeking) {
        self.seekTo(self.timeTrack.value);
      }
    };

    this.timeTrack.onchange = function () {
      if (!self.seeking) {
        self.seekTo(self.timeTrack.value);
      }
    };
  }
};

Player.prototype.onGetFileInfo = function (info) {
  if (this.playerState == playerStateIdle) {
    return;
  } //  this.logger.logInfo("Got file size rsp:" + info.st + " size:" + info.sz + " byte.");


  if (info.st == 200) {
    this.fileInfo.size = info.sz; //    this.logger.logInfo("Initializing decoder.");

    var req = {
      t: kInitDecoderReq,
      s: this.fileInfo.size,
      c: this.fileInfo.chunkSize
    };
    this.decodeWorker.postMessage(req);
  } else {
    this.reportPlayError(-1, info.st);
  }
};

Player.prototype.onFileData = function (data, start, end, seq) {
  //this.logger.logInfo("Got data bytes=" + start + "-" + end + ".");
  this.downloading = false;

  if (this.playerState == playerStateIdle) {
    return;
  }

  if (seq != this.downloadSeqNo) {
    return; // Old data.
  }

  if (this.playerState == playerStatePausing) {
    if (this.seeking) {
      setTimeout(() => {
        this.resume(true);
      }, 0);
    } else {
      return;
    }
  }

  var len = end - start + 1;
  this.fileInfo.offset += len;
  var objData = {
    t: kFeedDataReq,
    d: data
  };
  this.decodeWorker.postMessage(objData, [objData.d]);

  switch (this.decoderState) {
    case decoderStateIdle:
      this.onFileDataUnderDecoderIdle();
      break;

    case decoderStateInitializing:
      this.onFileDataUnderDecoderInitializing();
      break;

    case decoderStateReady:
      this.onFileDataUnderDecoderReady();
      break;
  }

  if (this.urgent) {
    setTimeout(() => {
      this.downloadOneChunk();
    }, 0);
  }
};

Player.prototype.onFileDataUnderDecoderIdle = function () {
  if (this.fileInfo.offset >= this.waitHeaderLength) {
    //    this.logger.logInfo("Opening decoder.");
    this.decoderState = decoderStateInitializing;
    var req = {
      t: kOpenDecoderReq
    };
    this.decodeWorker.postMessage(req);
  }

  this.downloadOneChunk();
};

Player.prototype.onFileDataUnderDecoderInitializing = function () {
  this.downloadOneChunk();
};

Player.prototype.onFileDataUnderDecoderReady = function () {//this.downloadOneChunk();
};

Player.prototype.onInitDecoder = function (objData) {
  if (this.playerState == playerStateIdle) {
    return;
  } //  this.logger.logInfo("Init decoder response " + objData.e + ".");


  if (objData.e == 0) {
    if (!this.isStream) {
      this.downloadOneChunk();
    }
  } else {
    this.reportPlayError(objData.e);
  }
};

Player.prototype.onOpenDecoder = function (objData) {
  if (this.playerState == playerStateIdle) {
    return;
  } //   this.logger.logInfo("Open decoder response " + objData.e + ".");


  if (objData.e == 0) {
    this.onVideoParam(objData.v);
    this.onAudioParam(objData.a);
    this.decoderState = decoderStateReady; //   this.logger.logInfo("Decoder ready now.");

    this.startDecoding();
  } else {
    this.reportPlayError(objData.e);
  }
};

Player.prototype.onVideoParam = function (v) {
  if (this.playerState == playerStateIdle) {
    return;
  } //   this.logger.logInfo("Video param duation:" + v.d + " pixFmt:" + v.p + " width:" + v.w + " height:" + v.h + ".");


  this.duration = v.d;
  this.pixFmt = v.p; //this.canvas.width = v.w;
  //this.canvas.height = v.h;

  this.videoWidth = v.w;
  this.videoHeight = v.h;
  this.yLength = this.videoWidth * this.videoHeight;
  this.uvLength = this.videoWidth / 2 * (this.videoHeight / 2);
  /*
  //var playCanvasContext = playCanvas.getContext("2d"); //If get 2d, webgl will be disabled.
  this.webglPlayer = new WebGLPlayer(this.canvas, {
      preserveDrawingBuffer: false
  });
  */

  if (this.timeTrack) {
    this.timeTrack.min = 0;
    this.timeTrack.max = this.duration;
    this.timeTrack.value = 0;
    this.displayDuration = this.formatTime(this.duration / 1000);
  }

  var byteRate = 1000 * this.fileInfo.size / this.duration;
  var targetSpeed = downloadSpeedByteRateCoef * byteRate;
  var chunkPerSecond = targetSpeed / this.fileInfo.chunkSize;
  this.chunkInterval = 1000 / chunkPerSecond;

  if (!this.isStream) {
    this.startDownloadTimer();
  } //   this.logger.logInfo("Byte rate:" + byteRate + " target speed:" + targetSpeed + " chunk interval:" + this.chunkInterval + ".");

};

Player.prototype.onAudioParam = function (a) {
  if (this.playerState == playerStateIdle) {
    return;
  } //  this.logger.logInfo("Audio param sampleFmt:" + a.f + " channels:" + a.c + " sampleRate:" + a.r + ".");


  var sampleFmt = a.f;
  var channels = a.c;
  var sampleRate = a.r;
  var encoding = "16bitInt";

  switch (sampleFmt) {
    case 0:
      encoding = "8bitInt";
      break;

    case 1:
      encoding = "16bitInt";
      break;

    case 2:
      encoding = "32bitInt";
      break;

    case 3:
      encoding = "32bitFloat";
      break;

  } //  this.logger.logInfo("Audio encoding " + encoding + ".");


  this.pcmPlayer = new PCMPlayer({
    encoding: encoding,
    channels: channels,
    sampleRate: sampleRate,
    flushingTime: 5000
  });
  this.audioEncoding = encoding;
  this.audioChannels = channels;
  this.audioSampleRate = sampleRate;
};

Player.prototype.restartAudio = function () {
  if (this.pcmPlayer) {
    this.pcmPlayer.destroy();
    this.pcmPlayer = null;
  }

  this.pcmPlayer = new PCMPlayer({
    encoding: this.audioEncoding,
    channels: this.audioChannels,
    sampleRate: this.audioSampleRate,
    flushingTime: 5000
  });
};

Player.prototype.bufferFrame = function (frame) {
  // If not decoding, it may be frame before seeking, should be discarded.
  if (!this.decoding) {
    return;
  }

  this.frameBuffer.push(frame); //this.logger.logInfo("bufferFrame " + frame.s + ", seq " + frame.q);

  if (this.getBufferTimerLength() >= maxBufferTimeLength || this.decoderState == decoderStateFinished) {
    if (this.decoding) {
      //this.logger.logInfo("Frame buffer time length >= " + maxBufferTimeLength + ", pause decoding.");
      this.pauseDecoding();
    }

    if (this.buffering) {
      this.stopBuffering();
    }
  }
};

Player.prototype.displayAudioFrame = function (frame) {
  if (this.playerState != playerStatePlaying) {
    return false;
  }

  if (this.seeking) {
    this.restartAudio();
    this.startTrackTimer();
    this.hideLoading();
    this.seeking = false;
  }

  if (this.isStream && this.firstAudioFrame) {
    this.firstAudioFrame = false;
    this.beginTimeOffset = frame.s;
  }

  this.pcmPlayer.play(new Uint8Array(frame.d));
  return true;
};

Player.prototype.onAudioFrame = function (frame) {
  this.bufferFrame(frame);
};

Player.prototype.onDecodeFinished = function (objData) {
  this.pauseDecoding();
  this.decoderState = decoderStateFinished;
};

Player.prototype.getBufferTimerLength = function () {
  if (!this.frameBuffer || this.frameBuffer.length == 0) {
    return 0;
  }

  let oldest = this.frameBuffer[0];
  let newest = this.frameBuffer[this.frameBuffer.length - 1];
  return newest.s - oldest.s;
};

Player.prototype.onVideoFrame = function (frame) {
  this.bufferFrame(frame);
};

Player.prototype.displayVideoFrame = function (frame) {
  if (this.playerState != playerStatePlaying) {
    return false;
  }

  if (this.seeking) {
    this.restartAudio();
    this.startTrackTimer();
    this.hideLoading();
    this.seeking = false;
  }

  var audioCurTs = this.pcmPlayer.getTimestamp();
  var audioTimestamp = audioCurTs + this.beginTimeOffset;
  var delay = frame.s - audioTimestamp; //this.logger.logInfo("displayVideoFrame delay=" + delay + "=" + " " + frame.s  + " - (" + audioCurTs  + " + " + this.beginTimeOffset + ")" + "->" + audioTimestamp);

  if (audioTimestamp <= 0 || delay <= 0) {
    var data = new Uint8Array(frame.d);
    this.renderVideoFrame(data);
    return true;
  }

  return false;
};

Player.prototype.onSeekToRsp = function (ret) {
  if (ret != 0) {
    this.justSeeked = false;
    this.seeking = false;
  }
};

Player.prototype.onRequestData = function (offset) {
  if (this.justSeeked) {
    //  this.logger.logInfo("Request data " + offset);
    if (offset >= 0 && offset < this.fileInfo.size) {
      this.fileInfo.offset = offset;
    }

    this.startDownloadTimer(); //this.restartAudio();

    this.justSeeked = false;
  }
};

Player.prototype.displayLoop = function () {
  requestAnimationFrame(this.displayLoop.bind(this));

  if (this.playerState != playerStatePlaying) {
    return;
  }

  if (this.frameBuffer.length == 0) {
    return;
  }

  if (this.buffering) {
    return;
  } // requestAnimationFrame may be 60fps, if stream fps too large, 
  // we need to render more frames in one loop, otherwise display
  // fps won't catch up with source fps, leads to memory increasing,
  // set to 2 now.


  for (let i = 0; i < 2; ++i) {
    var frame = this.frameBuffer[0];

    switch (frame.t) {
      case kAudioFrame:
        if (this.displayAudioFrame(frame)) {
          this.frameBuffer.shift();
        }

        break;

      case kVideoFrame:
        if (this.displayVideoFrame(frame)) {
          this.frameBuffer.shift();
        }

        break;

      default:
        return;
    }

    if (this.frameBuffer.length == 0) {
      break;
    }
  }

  if (this.getBufferTimerLength() < maxBufferTimeLength / 2) {
    if (!this.decoding) {
      //this.logger.logInfo("Buffer time length < " + maxBufferTimeLength / 2 + ", restart decoding.");
      this.startDecoding();
    }
  }

  if (this.bufferFrame.length == 0) {
    if (this.decoderState == decoderStateFinished) {
      this.reportPlayError(1, 0, "Finished");
      this.stop();
    } else {
      this.startBuffering();
    }
  }
};

Player.prototype.startBuffering = function () {
  this.buffering = true;
  this.showLoading();
  this.pause();
};

Player.prototype.stopBuffering = function () {
  this.buffering = false;
  this.hideLoading();
  this.resume();
};

Player.prototype.renderVideoFrame = function (data) {
  this.webglPlayer.renderFrame(data, this.videoWidth, this.videoHeight, this.yLength, this.uvLength);
};

Player.prototype.downloadOneChunk = function () {
  if (this.downloading || this.isStream) {
    return;
  }

  var start = this.fileInfo.offset;

  if (start >= this.fileInfo.size) {
    //  this.logger.logError("Reach file end.");
    this.stopDownloadTimer();
    return;
  }

  var end = this.fileInfo.offset + this.fileInfo.chunkSize - 1;

  if (end >= this.fileInfo.size) {
    end = this.fileInfo.size - 1;
  }

  var len = end - start + 1;

  if (len > this.fileInfo.chunkSize) {
    console.log("Error: request len:" + len + " > chunkSize:" + this.fileInfo.chunkSize);
    return;
  }

  var req = {
    t: kDownloadFileReq,
    u: this.fileInfo.url,
    s: start,
    e: end,
    q: this.downloadSeqNo,
    p: this.downloadProto
  };
  this.downloadWorker.postMessage(req);
  this.downloading = true;
};

Player.prototype.startDownloadTimer = function () {
  var self = this;
  this.downloadSeqNo++;
  this.downloadTimer = setInterval(function () {
    self.downloadOneChunk();
  }, this.chunkInterval);
};

Player.prototype.stopDownloadTimer = function () {
  if (this.downloadTimer != null) {
    clearInterval(this.downloadTimer);
    this.downloadTimer = null;
  }

  this.downloading = false;
};

Player.prototype.startTrackTimer = function () {
  var self = this;
  this.trackTimer = setInterval(function () {
    self.updateTrackTime();
  }, this.trackTimerInterval);
};

Player.prototype.stopTrackTimer = function () {
  if (this.trackTimer != null) {
    clearInterval(this.trackTimer);
    this.trackTimer = null;
  }
};

Player.prototype.updateTrackTime = function () {
  if (this.playerState == playerStatePlaying && this.pcmPlayer) {
    var currentPlayTime = this.pcmPlayer.getTimestamp() + this.beginTimeOffset;

    if (this.timeTrack) {
      this.timeTrack.value = 1000 * currentPlayTime;
    }

    if (this.timeLabel) {
      this.timeLabel.innerHTML = this.formatTime(currentPlayTime) + "/" + this.displayDuration;
    }
  }
};

Player.prototype.startDecoding = function () {
  var req = {
    t: kStartDecodingReq,
    i: this.decodeInterval
  };
  this.decodeWorker.postMessage(req);
  this.decoding = true;
};

Player.prototype.pauseDecoding = function () {
  var req = {
    t: kPauseDecodingReq
  };
  this.decodeWorker.postMessage(req);
  this.decoding = false;
};

Player.prototype.formatTime = function (s) {
  var h = Math.floor(s / 3600) < 10 ? '0' + Math.floor(s / 3600) : Math.floor(s / 3600);
  var m = Math.floor(s / 60 % 60) < 10 ? '0' + Math.floor(s / 60 % 60) : Math.floor(s / 60 % 60);
  var s = Math.floor(s % 60) < 10 ? '0' + Math.floor(s % 60) : Math.floor(s % 60);
  return result = h + ":" + m + ":" + s;
};

Player.prototype.reportPlayError = function (error, status, message) {
  var e = {
    error: error || 0,
    status: status || 0,
    message: message
  };

  if (this.callback) {
    this.callback(e);
  }
};

Player.prototype.setLoadingDiv = function (loadingDiv) {
  this.loadingDiv = loadingDiv;
};

Player.prototype.hideLoading = function () {
  if (this.loadingDiv != null) {
    loading.style.display = "none";
  }
};

Player.prototype.showLoading = function () {
  if (this.loadingDiv != null) {
    loading.style.display = "block";
  }
};

Player.prototype.registerVisibilityEvent = function (cb) {
  var hidden = "hidden"; // Standards:

  if (hidden in document) {
    document.addEventListener("visibilitychange", onchange);
  } else if ((hidden = "mozHidden") in document) {
    document.addEventListener("mozvisibilitychange", onchange);
  } else if ((hidden = "webkitHidden") in document) {
    document.addEventListener("webkitvisibilitychange", onchange);
  } else if ((hidden = "msHidden") in document) {
    document.addEventListener("msvisibilitychange", onchange);
  } else if ("onfocusin" in document) {
    // IE 9 and lower.
    document.onfocusin = document.onfocusout = onchange;
  } else {
    // All others.
    window.onpageshow = window.onpagehide = window.onfocus = window.onblur = onchange;
  }

  function onchange(evt) {
    var v = true;
    var h = false;
    var evtMap = {
      focus: v,
      focusin: v,
      pageshow: v,
      blur: h,
      focusout: h,
      pagehide: h
    };
    evt = evt || window.event;
    var visible = v;

    if (evt.type in evtMap) {
      visible = evtMap[evt.type];
    } else {
      visible = this[hidden] ? h : v;
    }

    cb(visible);
  } // set the initial state (but only if browser supports the Page Visibility API)


  if (document[hidden] !== undefined) {
    onchange({
      type: document[hidden] ? "blur" : "focus"
    });
  }
};

Player.prototype.onStreamDataUnderDecoderIdle = function (length) {
  if (this.streamReceivedlen >= this.waitHeaderLength) {
    //  this.logger.logInfo("Opening decoder.");
    this.decoderState = decoderStateInitializing;
    var req = {
      t: kOpenDecoderReq
    };
    this.decodeWorker.postMessage(req);
  } else {
    this.streamReceivedlen += length;
  }
};

Player.prototype.requestStream = function (url) {
  var self = this;
  this.fetchController = new AbortController();
  const signal = this.fetchController.signal;
  fetch(url, {
    signal
  }).then(async function respond(response) {
    const reader = response.body.getReader();
    reader.read().then(function processData({
      done,
      value
    }) {
      if (done) {
        //    self.logger.logInfo("Stream done.");
        return;
      }

      if (self.playerState != playerStatePlaying) {
        return;
      }

      var dataLength = value.byteLength;
      var offset = 0;

      if (dataLength > self.fileInfo.chunkSize) {
        do {
          let len = Math.min(self.fileInfo.chunkSize, dataLength);
          var data = value.buffer.slice(offset, offset + len);
          dataLength -= len;
          offset += len;
          var objData = {
            t: kFeedDataReq,
            d: data
          };
          self.decodeWorker.postMessage(objData, [objData.d]);
        } while (dataLength > 0);
      } else {
        var objData = {
          t: kFeedDataReq,
          d: value.buffer
        };
        self.decodeWorker.postMessage(objData, [objData.d]);
      }

      if (self.decoderState == decoderStateIdle) {
        self.onStreamDataUnderDecoderIdle(dataLength);
      }

      return reader.read().then(processData);
    });
  }).catch(err => {});
};

function SinglePlayer({
  type,
  file,
  h265lib,
  className,
  autoPlay,
  muted,
  poster,
  playsinline,
  loop,
  preload,
  children,
  onInitPlayer,
  ...props
}) {
  const playContainerRef = useRef(null);
  const [playerObj, setPlayerObj] = useState(null);
  const [canvsShow, setcanvsShow] = useState(false);
  const [canPlay, setcanPlay] = useState(true);
  const DEMUX_MSG_EVENT = 'demux_msg';
  let isfirst = false;
  useEffect(() => {
    if (!file) {
      return;
    }

    const playerObject = {
      playContainer: playContainerRef.current,
      video: playContainerRef.current.querySelector('video')
    };
    const formartType = getVideoType(file);

    if (formartType === 'flv' || type === 'flv') {
      playerObject.flv = createFlvPlayer(playerObject.video, { ...props,
        file
      });
      playerObject.flv.on(DEMUX_MSG_EVENT, data => {
        if (data !== 7) {
          !isfirst && setcanvsShow(true);
          isfirst = true;
        }
      });
    }

    if (formartType === 'm3u8' || type === 'hls') {
      playerObject.hls = createHlsPlayer(playerObject.video, file);
    }

    if (!['flv', 'm3u8'].includes(formartType) || type === 'native') {
      playerObject.video.src = file;
    }

    playerObject.event = new VideoEventInstance(playerObject.video);
    playerObject.api = new Api(playerObject);
    setPlayerObj(playerObject);

    if (onInitPlayer) {
      onInitPlayer(Object.assign({}, playerObject.api.getApi(), playerObject.event.getApi()));
    }

    return () => {
      if (playerObject.api) {
        playerObject.api.unload();
      }
    };
  }, [file]);
  const PlayerA = new Player(h265lib);
  const HplayCreater = useCallback(() => {
    PlayerA.play(file, document.getElementById('playCanvas'), function (e) {
      if (e.error == 1) ;
    }, 512 * 1024, true);
  }, [canvsShow]);
  useEffect(() => {
    if (canvsShow) {
      HplayCreater();
    }
  }, [canvsShow]);
  const hplay = useCallback(() => {
    PlayerA.pause();
    setcanPlay(false);
  }, [file, canvsShow]);
  const hstop = useCallback(() => {
    PlayerA.resume();
    setcanPlay(true);
  }, [file, canvsShow]);
  const fullscreen = useCallback(() => {
    PlayerA.fullscreen();
  }, [file, canvsShow]);
  return React.createElement(React.Fragment, null, !canvsShow ? React.createElement("div", {
    className: `lm-player-container ${className}`,
    ref: playContainerRef
  }, React.createElement("div", {
    className: "player-mask-layout"
  }, React.createElement("video", {
    autoPlay: autoPlay,
    preload: preload,
    muted: muted,
    poster: poster,
    controls: false,
    playsInline: playsinline,
    loop: loop
  })), React.createElement(VideoTools, {
    playerObj: playerObj,
    isLive: props.isLive,
    hideContrallerBar: props.hideContrallerBar,
    errorReloadTimer: props.errorReloadTimer,
    scale: props.scale,
    snapshot: props.snapshot,
    leftExtContents: props.leftExtContents,
    leftMidExtContents: props.leftMidExtContents,
    rightExtContents: props.rightExtContents,
    rightMidExtContents: props.rightMidExtContents,
    draggable: props.draggable
  }), children) : React.createElement("div", {
    className: "h265-bar",
    style: {
      position: "relative"
    }
  }, React.createElement("canvas", {
    id: "playCanvas",
    width: "800",
    height: "400"
  }), React.createElement("div", {
    className: `contraller-bar-layout `
  }, canPlay ? React.createElement(IconFont, {
    title: "\u64AD\u653E",
    onClick: hplay,
    type: 'lm-player-Pause_Main'
  }) : React.createElement(IconFont, {
    title: "\u64AD\u653E",
    onClick: hstop,
    type: 'lm-player-Play_Main'
  }), React.createElement(IconFont, {
    title:  '窗口' ,
    onClick: fullscreen,
    type:  'lm-player-ExitFull_Main' 
  }))));
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
    return React.createElement(NoSource, null);
  }

  return React.createElement(React.Fragment, null, React.createElement(VideoMessage, {
    api: playerObj.api,
    event: playerObj.event
  }), draggable && React.createElement(DragEvent, {
    playContainer: playerObj.playContainer,
    api: playerObj.api,
    event: playerObj.event
  }),  React.createElement(ContrallerEvent, {
    event: playerObj.event,
    playContainer: playerObj.playContainer
  }, React.createElement(ContrallerBar, {
    api: playerObj.api,
    event: playerObj.event,
    playContainer: playerObj.playContainer,
    video: playerObj.video,
    snapshot: snapshot,
    rightExtContents: rightExtContents,
    rightMidExtContents: rightMidExtContents,
    scale: scale,
    isHistory: false,
    isLive: isLive,
    leftExtContents: leftExtContents,
    leftMidExtContents: leftMidExtContents
  }), !isLive && React.createElement(TineLine, {
    api: playerObj.api,
    event: playerObj.event
  })), React.createElement(ErrorEvent, {
    flv: playerObj.flv,
    hls: playerObj.hls,
    api: playerObj.api,
    event: playerObj.event,
    errorReloadTimer: errorReloadTimer
  }), isLive && React.createElement(LiveHeart, {
    api: playerObj.api
  }));
}

SinglePlayer.propTypes = {
  file: PropTypes.string.isRequired,
  //播放地址 必填
  isLive: PropTypes.bool,
  //是否实时视频
  errorReloadTimer: PropTypes.number,
  //视频错误重连次数
  type: PropTypes.oneOf(['flv', 'hls', 'native']),
  //强制视频流类型
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
};
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
};

const computedLineList = historyList => {
  const duration = historyList.duration;
  return historyList.fragments.map(v => {
    return {
      disabled: !v.file,
      size: (v.end - v.begin) / duration * 100
    };
  });
};

function TineLine$1({
  event,
  api,
  visibel,
  historyList,
  playIndex,
  seekTo
}) {
  const [state, setState] = useState({
    duration: 1,
    currentTime: 0,
    buffered: 0,
    isEnd: false
  });
  useEffect(() => {
    const getDuration = () => setState(old => ({ ...old,
      duration: api.getDuration()
    }));

    const getCurrentTime = () => setState(old => ({ ...old,
      currentTime: api.getCurrentTime(),
      buffered: api.getSecondsLoaded()
    }));

    const getBuffered = () => setState(old => ({ ...old,
      buffered: api.getSecondsLoaded()
    }));

    const historyPlayEnd = () => setState(old => ({ ...old,
      isEnd: true
    }));

    const reload = () => setState(old => ({ ...old,
      isEnd: false,
      currentTime: api.getCurrentTime()
    }));

    const seekendPlay = () => api.play();

    event.addEventListener('loadedmetadata', getDuration);
    event.addEventListener('durationchange', getDuration);
    event.addEventListener('timeupdate', getCurrentTime);
    event.addEventListener('progress', getBuffered);
    event.addEventListener('suspend', getBuffered);
    event.addEventListener('seeked', seekendPlay);
    event.on(EventName.HISTORY_PLAY_END, historyPlayEnd);
    event.on(EventName.RELOAD, reload);
    return () => {
      event.removeEventListener('loadedmetadata', getDuration);
      event.removeEventListener('durationchange', getDuration);
      event.removeEventListener('timeupdate', getCurrentTime);
      event.removeEventListener('progress', getBuffered);
      event.removeEventListener('suspend', getBuffered);
      event.removeEventListener('seeked', seekendPlay);
      event.off(EventName.HISTORY_PLAY_END, historyPlayEnd);
      event.off(EventName.RELOAD, reload);
    };
  }, [event, api]);
  const changePlayTime = useCallback(percent => {
    const currentTime = percent * historyList.duration; //修正一下误差

    seekTo(currentTime);
    setState(old => ({ ...old,
      currentTime,
      isEnd: false
    }));
  }, [historyList]);

  const renderTimeLineTips = percent => {
    const currentTime = percent * historyList.duration * 1000;
    const date = dateFormat(historyList.beginDate + currentTime);
    return React.createElement("span", null, date);
  };

  const {
    currentTime,
    buffered,
    isEnd
  } = state;
  const lineList = useMemo(() => computedLineList(historyList), [historyList]);
  const currentLine = useMemo(() => lineList.filter((_, i) => i < playIndex).map(v => v.size), [playIndex, lineList]);
  const currentIndexTime = useMemo(() => currentLine.length === 0 ? 0 : currentLine.length > 1 ? currentLine.reduce((p, c) => p + c) : currentLine[0], [currentLine]);
  const playPercent = useMemo(() => currentTime / historyList.duration * 100 + currentIndexTime, [currentIndexTime, historyList, currentTime]);
  const bufferedPercent = useMemo(() => buffered / historyList.duration * 100 + currentIndexTime, [historyList, currentIndexTime, buffered]);
  return React.createElement("div", {
    className: `video-time-line-layout ${!visibel ? 'hide-time-line' : ''}`
  }, React.createElement(IconFont, {
    type: "lm-player-PrevFast",
    onClick: api.backWind,
    className: "time-line-action-item"
  }), React.createElement(Slider, {
    className: "time-line-box",
    currentPercent: isEnd ? '100' : playPercent,
    availablePercent: bufferedPercent,
    onChange: changePlayTime,
    renderTips: renderTimeLineTips
  }, React.createElement(React.Fragment, null, lineList.map((v, i) => {
    const currentSizeLine = lineList.filter((v, i2) => i2 < i).map(v => v.size);
    const currentIndexSize = currentSizeLine.length === 0 ? 0 : currentSizeLine.length > 1 ? currentSizeLine.reduce((p, c) => p + c) : currentSizeLine[0];
    return React.createElement("div", {
      className: `history-time-line-item ${v.disabled ? 'history-time-line-disabled' : ''}`,
      key: i,
      style: {
        width: `${v.size}%`,
        left: `${currentIndexSize}%`
      }
    });
  }))), React.createElement(IconFont, {
    type: "lm-player-NextFast_Light",
    onClick: api.fastForward,
    className: "time-line-action-item"
  }));
}

TineLine$1.propTypes = {
  event: PropTypes.object,
  api: PropTypes.object,
  changePlayIndex: PropTypes.func,
  playIndex: PropTypes.number,
  historyList: PropTypes.array,
  seekTo: PropTypes.func,
  visibel: PropTypes.bool
};

/**
 * history下使用 用户切换下个播放地址
 */

function PlayEnd({
  event,
  changePlayIndex,
  playIndex
}) {
  useEffect(() => {
    const endedHandle = () => changePlayIndex(playIndex + 1);

    event.addEventListener('ended', endedHandle, false);
    return () => {
      event.removeEventListener('ended', endedHandle, false);
    };
  }, [event, playIndex]);
  return React.createElement(React.Fragment, null);
}

PlayEnd.propTypes = {
  event: PropTypes.object,
  changePlayIndex: PropTypes.func,
  playIndex: PropTypes.number
};

const computedIndexFormTime = (historyList, time) => {
  let index = 0;

  try {
    index = historyList.fragments.findIndex(v => v.end > time);
  } catch (e) {
    console.error('historyList data error', historyList);
  }

  return index;
};

const computedTimeAndIndex = (historyList, currentTime) => {
  const index = computedIndexFormTime(historyList, currentTime);
  let seekTime = 0;

  try {
    const fragment = historyList.fragments[index];

    if (!fragment) {
      return [0, 0];
    }

    seekTime = currentTime - fragment.begin - 1;
  } catch (e) {
    console.error('historyList data error', historyList);
  }

  return [index, seekTime];
};

function HistoryPlayer({
  type,
  historyList,
  defaultTime,
  className,
  autoPlay,
  muted,
  poster,
  playsinline,
  loop,
  preload,
  children,
  onInitPlayer,
  ...props
}) {
  const playContainerRef = useRef(null);
  const [playerObj, setPlayerObj] = useState(null);
  const [playStatus, setPlayStatus] = useState(() => computedTimeAndIndex(historyList, defaultTime));
  const playIndex = useMemo(() => playStatus[0], [playStatus]);
  const defaultSeekTime = useMemo(() => playStatus[1], [playStatus]);
  const file = useMemo(() => {
    let url;

    try {
      url = historyList.fragments[playIndex].file;
    } catch (e) {
      console.warn('未找打播放地址！', historyList);
    }

    return url;
  }, [historyList, playIndex]);
  /**
   * 重写api下的seekTo方法
   */

  const seekTo = useCallback(currentTime => {
    const [index, seekTime] = computedTimeAndIndex(historyList, currentTime);

    if (playerObj.event && playerObj.api) {
      //判断是否需要更新索引
      setPlayStatus(old => {
        if (old[0] !== index) {
          return [index, seekTime];
        } else {
          playerObj.api.seekTo(seekTime, true);
          playerObj.event.emit(EventName.SEEK, currentTime);
          return old;
        }
      });
    }
  }, [playIndex, playerObj, playerObj, historyList]);
  const changePlayIndex = useCallback(index => {
    if (index > historyList.fragments.length - 1) {
      return playerObj.event && playerObj.event.emit(EventName.HISTORY_PLAY_END);
    }

    if (playerObj.event) {
      playerObj.event.emit(EventName.CHANGE_PLAY_INDEX, index);
    }

    setPlayStatus([index, 0]);
  }, [playerObj]);
  const reloadHistory = useCallback(() => {
    setPlayStatus([0, 0]);
    playerObj.event.emit(EventName.RELOAD);
  }, [playerObj]);
  useEffect(() => {
    if (!file) {
      return;
    }

    const playerObject = {
      playContainer: playContainerRef.current,
      video: playContainerRef.current.querySelector('video')
    };
    const formartType = getVideoType(file);

    if (formartType === 'flv' || type === 'flv') {
      playerObject.flv = createFlvPlayer(playerObject.video, { ...props,
        file
      });
    }

    if (formartType === 'm3u8' || type === 'hls') {
      playerObject.hls = createHlsPlayer(playerObject.video, file);
    }

    if (!['flv', 'm3u8'].includes(formartType) || type === 'native') {
      playerObject.video.src = file;
    }

    playerObject.event = new VideoEventInstance(playerObject.video);
    playerObject.api = new Api(playerObject);
    setPlayerObj(playerObject);

    if (defaultSeekTime) {
      playerObject.api.seekTo(defaultSeekTime);
    }

    if (onInitPlayer) {
      onInitPlayer(Object.assign({}, playerObject.api.getApi(), playerObject.event.getApi(), {
        seekTo,
        changePlayIndex,
        reload: reloadHistory
      }));
    }

    return () => {
      if (playerObject.api) {
        playerObject.api.unload();
      }
    };
  }, [historyList, file]);
  /**
   * 根据时间计算当前对应的播放索引
   */

  return React.createElement("div", {
    className: `lm-player-container ${className}`,
    ref: playContainerRef
  }, React.createElement("div", {
    className: "player-mask-layout"
  }, React.createElement("video", {
    autoPlay: autoPlay,
    preload: preload,
    muted: muted,
    poster: poster,
    controls: false,
    playsInline: playsinline,
    loop: loop
  })), React.createElement(VideoTools$1, {
    playerObj: playerObj,
    isLive: props.isLive,
    hideContrallerBar: props.hideContrallerBar,
    errorReloadTimer: props.errorReloadTimer,
    scale: props.scale,
    snapshot: props.snapshot,
    leftExtContents: props.leftExtContents,
    leftMidExtContents: props.leftMidExtContents,
    rightExtContents: props.rightExtContents,
    rightMidExtContents: props.rightMidExtContents,
    draggable: props.draggable,
    changePlayIndex: changePlayIndex,
    reloadHistory: reloadHistory,
    historyList: historyList,
    playIndex: playIndex,
    seekTo: seekTo
  }), children);
}

function VideoTools$1({
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
  errorReloadTimer,
  changePlayIndex,
  reloadHistory,
  historyList,
  seekTo,
  playIndex
}) {
  if (!playerObj) {
    return React.createElement(NoSource, null);
  }

  return React.createElement(React.Fragment, null, React.createElement(VideoMessage, {
    api: playerObj.api,
    event: playerObj.event
  }), draggable && React.createElement(DragEvent, {
    playContainer: playerObj.playContainer,
    api: playerObj.api,
    event: playerObj.event
  }), !hideContrallerBar && React.createElement(ContrallerEvent, {
    event: playerObj.event,
    playContainer: playerObj.playContainer
  }, React.createElement(ContrallerBar, {
    api: playerObj.api,
    event: playerObj.event,
    playContainer: playerObj.playContainer,
    video: playerObj.video,
    snapshot: snapshot,
    rightExtContents: rightExtContents,
    rightMidExtContents: rightMidExtContents,
    scale: scale,
    isHistory: true,
    isLive: isLive,
    leftExtContents: leftExtContents,
    leftMidExtContents: leftMidExtContents,
    reloadHistory: reloadHistory
  }), React.createElement(TineLine$1, {
    changePlayIndex: changePlayIndex,
    historyList: historyList,
    playIndex: playIndex,
    seekTo: seekTo,
    api: playerObj.api,
    event: playerObj.event
  })), React.createElement(ErrorEvent, {
    changePlayIndex: changePlayIndex,
    playIndex: playIndex,
    isHistory: true,
    flv: playerObj.flv,
    hls: playerObj.hls,
    api: playerObj.api,
    event: playerObj.event,
    errorReloadTimer: errorReloadTimer
  }), React.createElement(PlayEnd, {
    event: playerObj.event,
    changePlayIndex: changePlayIndex,
    playIndex: playIndex
  }));
}

HistoryPlayer.propTypes = {
  historyList: PropTypes.object.isRequired,
  //播放地址 必填
  errorReloadTimer: PropTypes.number,
  //视频错误重连次数
  type: PropTypes.oneOf(['flv', 'hls', 'native']),
  //强制视频流类型
  onInitPlayer: PropTypes.func,
  isDraggable: PropTypes.bool,
  isScale: PropTypes.bool,
  muted: PropTypes.string,
  autoPlay: PropTypes.bool,
  playsInline: PropTypes.bool,
  preload: PropTypes.string,
  poster: PropTypes.string,
  loop: PropTypes.bool,
  defaultTime: PropTypes.number,
  className: PropTypes.string,
  playsinline: PropTypes.bool,
  children: PropTypes.any,
  autoplay: PropTypes.bool,
  rightExtContents: PropTypes.element,
  rightMidExtContents: PropTypes.element,
  leftExtContents: PropTypes.element,
  leftMidExtContents: PropTypes.element,
  flvOptions: PropTypes.object,
  flvConfig: PropTypes.object
};
HistoryPlayer.defaultProps = {
  draggable: true,
  scale: true,
  errorReloadTimer: 5,
  muted: 'muted',
  autoPlay: true,
  playsInline: false,
  preload: 'auto',
  loop: false,
  defaultTime: 0,
  historyList: {
    beginDate: 0,
    duration: 0,
    fragments: []
  }
};

function createPlayer({
  container,
  children,
  onInitPlayer,
  ...props
}) {
  ReactDOM.render(React.createElement(SinglePlayer, _extends({}, props, {
    onInitPlayer: player => {
      player.destroy = function () {
        ReactDOM.unmountComponentAtNode(container);
      };

      onInitPlayer && onInitPlayer(player);
    }
  }), children), container);
}
function createHistoryPlayer({
  container,
  children,
  onInitPlayer,
  ...props
}) {
  ReactDOM.render(React.createElement(HistoryPlayer, _extends({}, props, {
    onInitPlayer: player => {
      player.destroy = function () {
        ReactDOM.unmountComponentAtNode(container);
      };

      onInitPlayer && onInitPlayer(player);
    }
  }), children), container);
}

export default SinglePlayer;
export { Bar, EventName, HistoryPlayer, SinglePlayer as Player, createHistoryPlayer, createPlayer };
