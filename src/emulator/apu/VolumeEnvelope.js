
export default class VolumeEnvelope {
  constructor() {
    this.startFlag = false
    this.dividerCount = 0
    this.volume = 0
  }
  clock(period,loop) {
    if (this.startFlag) {
      this.startFlag = !this.startFlag
      this.volume = 15
      this.dividerCount = period
      return
    }

    if (this.dividerCount > 0) {
      this.dividerCount--
      return;
    }

    this.dividerCount = period
    if (this.volume == 0) {
      if (loop == true) this.volume = 15
    }
    else this.volume--
  }
}