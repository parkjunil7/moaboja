# 선택했던 나머지 고양이 원본을 로그인 화면용으로 축소합니다.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
foreach ($variant in @('couple','wallet','bank')) {
  $sourcePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../assets/branding/moaboja-cat-$variant-v1.png"))
  $sourceImage = [Drawing.Image]::FromFile($sourcePath)
  $icon = [Drawing.Bitmap]::new(320,320)
  $graphics = [Drawing.Graphics]::FromImage($icon)
  try {
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($sourceImage,[Drawing.Rectangle]::new(0,0,320,320))
    $icon.Save((Join-Path $PSScriptRoot "../public/icons/moaboja-cat-$variant-v1-320.png"),[Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $icon.Dispose()
    $sourceImage.Dispose()
  }
}
Write-Output '로그인 화면용 고양이 3종 생성 완료'
